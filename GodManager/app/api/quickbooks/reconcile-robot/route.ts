import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { getConnectionStatus } from '@/lib/quickbooks';
import { qbListAccounts } from '@/lib/quickbooksPost';
import { categorizeChaseTxn } from '@/lib/chaseTxnCategory';
import { flReconcilePlan, resolveQboAccount, type QboAccountLite } from '@/lib/flReconcileRules';
import { csrfGuard } from '@/lib/csrfGuard';
import { rateLimitGuard } from '@/lib/apiRateLimit';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Robô de conciliação QuickBooks (#66) — PREVIEW-FIRST, nunca concilia às cegas.
 *
 * GET  ?month=YYYY-MM  → prévia: transações do extrato Chase (BankStatementTxn, já parseadas)
 *   ainda não conciliadas (matched=false), com categoria sugerida (categorizeChaseTxn) e
 *   totais por tipo. Requer QuickBooks conectado.
 * POST { month, approve }  → aplica no QuickBooks (APENAS com approve=true E QBO_RECONCILE_ENABLED=1).
 *
 * NOTA de viabilidade: a fila "For Review" do QBO (as 273 pendentes) NÃO é exposta pela API
 * pública do QuickBooks Online. O caminho suportado é: categorizar as transações do banco (que
 * já temos parseadas) e CRIAR as entradas correspondentes no QBO (Purchase/Deposit) para casarem
 * automaticamente — feito só após sua aprovação. Enquanto QBO_RECONCILE_ENABLED!=1, o POST é no-op
 * seguro; a prévia (GET) já funciona e mostra o que seria conciliado.
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  try {
    const url = new URL(req.url);
    const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
    if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
    const clientId = scope.clientId;

    const conn = await getConnectionStatus(clientId);
    const connected = !!conn && (conn as { connected?: boolean }).connected !== false;

    const month = /^\d{4}-\d{2}$/.test(url.searchParams.get('month') || '') ? (url.searchParams.get('month') as string) : '';
    const txns = await prisma.bankStatementTxn.findMany({
      where: { clientId, matched: false, ...(month ? { periodMonth: month } : {}) },
      orderBy: [{ txnDate: 'asc' }],
      take: 1000,
      select: { id: true, bankAccountKey: true, periodMonth: true, txnDate: true, description: true, amount: true, section: true },
    });

    // Plano de contas REAL do QuickBooks (best-effort — só quando conectado) para mapear a conta.
    let qboAccounts: QboAccountLite[] = [];
    let accountsError: string | null = null;
    if (connected) {
      try {
        qboAccounts = (await qbListAccounts(clientId)) as QboAccountLite[];
      } catch (e) {
        accountsError = e instanceof Error ? e.message : 'Falha ao ler o plano de contas do QuickBooks.';
      }
    }

    const rows = txns.map((t) => {
      const amount = round2(Number(t.amount));
      const plan = flReconcilePlan(t.description, amount, t.bankAccountKey);
      const qa = qboAccounts.length ? resolveQboAccount(plan, qboAccounts) : null;
      return {
        id: t.id,
        account: t.bankAccountKey,
        month: t.periodMonth,
        date: t.txnDate.toISOString().slice(0, 10),
        description: t.description,
        amount,
        section: t.section,
        suggestedType: categorizeChaseTxn(t.description),
        plan,
        qboAccount: qa ? { id: qa.id, name: qa.name, acctNum: qa.acctNum } : null,
      };
    });

    // Resumo do mapeamento: categoria FL → conta do QuickBooks (para conferência antes de aplicar).
    const accountMap: Record<string, { qboAccount: string | null; count: number }> = {};
    for (const r of rows) {
      const k = r.plan.category;
      if (!accountMap[k]) accountMap[k] = { qboAccount: r.qboAccount ? (r.qboAccount.acctNum ? r.qboAccount.acctNum + ' · ' : '') + r.qboAccount.name : null, count: 0 };
      accountMap[k].count += 1;
    }
    const mappedCount = rows.filter((r) => r.qboAccount).length;

    const byType: Record<string, { count: number; amount: number }> = {};
    for (const r of rows) {
      const k = r.plan.category;
      byType[k] = byType[k] || { count: 0, amount: 0 };
      byType[k].count += 1;
      byType[k].amount = round2(byType[k].amount + Math.abs(r.amount));
    }
    const autoApplyCount = rows.filter((r) => r.plan.autoApply).length;
    const reviewCount = rows.length - autoApplyCount;

    return NextResponse.json({
      ok: true,
      connected,
      applyEnabled: process.env.QBO_RECONCILE_ENABLED === '1',
      month: month || null,
      pending: rows.length,
      autoApplyCount,
      reviewCount,
      byType,
      accountMap,
      mappedCount,
      accountsError,
      rows,
    });
  } catch (e) {
    console.error('[GET /api/quickbooks/reconcile-robot]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Falha ao montar a prévia de conciliação.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const bad = csrfGuard(req);
  if (bad) return bad;
  const rl = rateLimitGuard(req, { bucket: 'qb-reconcile-robot', max: 6 });
  if (rl) return rl;
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  const role = String(user.role || '').toLowerCase();
  if (role !== 'super_admin' && role !== 'admin' && role !== 'manager') {
    return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });
  }
  try {
    const body = (await req.json().catch(() => ({}))) as { month?: string; approve?: boolean; clientId?: string; markReconciled?: unknown };
    const scope = await resolveBankAccountClientScope(user, body.clientId || null);
    if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

    // Caminho A: o usuário categoriza no QBO (For Review) e marca aqui as pendências já conciliadas
    // (matched=true) para elas saírem da fila do robô. Só toca no nosso banco — nunca no QBO. Seguro.
    if (Array.isArray(body.markReconciled)) {
      const ids = (body.markReconciled as unknown[]).map((x) => String(x || '').trim()).filter(Boolean).slice(0, 2000);
      if (!ids.length) return NextResponse.json({ ok: false, error: 'Nenhuma transação informada.' }, { status: 400 });
      const res = await prisma.bankStatementTxn.updateMany({
        where: { id: { in: ids }, clientId: scope.clientId },
        data: { matched: true },
      });
      await recordAudit({
        request: req, actor: { id: user.id, email: user.email },
        action: 'quickbooks.reconcile_mark', entity: 'bank_statement_txn', entityId: scope.clientId, clientId: scope.clientId,
        details: `mark reconciled ${res.count} txn`,
      });
      return NextResponse.json({ ok: true, reconciled: res.count });
    }

    if (!body.approve) return NextResponse.json({ ok: false, error: 'Aprovação necessária (approve=true).' }, { status: 400 });
    if (process.env.QBO_RECONCILE_ENABLED !== '1') {
      return NextResponse.json(
        {
          ok: false,
          notConfigured: true,
          error:
            'Aplicação no QuickBooks desabilitada (QBO_RECONCILE_ENABLED != 1). A prévia funciona; a escrita no QBO precisa ser habilitada e testada com a conexão ativa antes de conciliar de verdade.',
        },
        { status: 501 },
      );
    }
    // TODO (habilitado): para cada BankStatementTxn aprovada, criar Purchase (débito) ou Deposit
    // (crédito) no QBO na conta/categoria sugerida e marcar matched=true. Retornar {created, failed}.
    await recordAudit({
      request: req, actor: { id: user.id, email: user.email },
      action: 'quickbooks.reconcile_robot', entity: 'bank_statement_txn', entityId: scope.clientId, clientId: scope.clientId,
      details: `reconcile robot approve month=${body.month || 'all'}`,
    });
    return NextResponse.json({ ok: true, created: 0, failed: 0, note: 'Robô habilitado — escrita no QBO a implementar após teste com conexão ativa.' });
  } catch (e) {
    console.error('[POST /api/quickbooks/reconcile-robot]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Falha no robô de conciliação.' }, { status: 500 });
  }
}
