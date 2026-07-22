import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { getConnectionStatus } from '@/lib/quickbooks';
import { qbListAccounts, qbCreatePurchase, qbCreateDeposit } from '@/lib/quickbooksPost';
import { categorizeChaseTxn } from '@/lib/chaseTxnCategory';
import { flReconcilePlan, resolveQboAccount, resolveQboBankAccount, flValidateEntry, type QboAccountLite } from '@/lib/flReconcileRules';
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

    // Relatório dos lançamentos JÁ criados no QuickBooks pelo robô (rastreio/auditoria).
    if (url.searchParams.get('posted') === '1') {
      const posted = await prisma.bankStatementTxn.findMany({
        where: { clientId, matchedQboId: { not: null } },
        orderBy: [{ txnDate: 'asc' }],
        take: 5000,
        select: { id: true, bankAccountKey: true, periodMonth: true, txnDate: true, description: true, amount: true, matchedQboId: true, matchedQboType: true },
      });
      return NextResponse.json({
        ok: true,
        count: posted.length,
        posted: posted.map((p) => ({
          id: p.id, account: p.bankAccountKey, month: p.periodMonth, date: p.txnDate.toISOString().slice(0, 10),
          description: p.description, amount: round2(Number(p.amount)), qboId: p.matchedQboId, qboType: p.matchedQboType,
        })),
      });
    }

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
    // Mapa manual do cliente (categoria FL / banco → conta real do QBO) — prioridade sobre o palpite.
    const mapRow = await prisma.qboReconcileMap.findUnique({ where: { clientId } });
    const savedMap = (mapRow?.mapping as { cat?: Record<string, string>; bank?: Record<string, string> } | undefined) || {};
    const savedCat = savedMap.cat || {};
    const savedBank = savedMap.bank || {};

    const rows = txns.map((t) => {
      const amount = round2(Number(t.amount));
      const plan = flReconcilePlan(t.description, amount, t.bankAccountKey);
      const qa = qboAccounts.length ? resolveQboAccount(plan, qboAccounts, savedCat) : null;
      const bank = qboAccounts.length ? resolveQboBankAccount(t.bankAccountKey, qboAccounts, savedBank) : null;
      // Conformidade FL: só há validação real quando o plano de contas foi lido.
      const compliance = qboAccounts.length ? flValidateEntry(plan, qa, bank, t.bankAccountKey, amount) : null;
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
        compliance: compliance ? { ok: compliance.ok, reason: compliance.reason || null } : null,
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
    const compliantCount = rows.filter((r) => r.compliance && r.compliance.ok).length;
    const blockedCount = rows.filter((r) => r.compliance && !r.compliance.ok).length;

    const byType: Record<string, { count: number; amount: number }> = {};
    for (const r of rows) {
      const k = r.plan.category;
      byType[k] = byType[k] || { count: 0, amount: 0 };
      byType[k].count += 1;
      byType[k].amount = round2(byType[k].amount + Math.abs(r.amount));
    }
    const autoApplyCount = rows.filter((r) => r.plan.autoApply).length;
    const reviewCount = rows.length - autoApplyCount;

    // Progresso: quantas já foram marcadas como conciliadas (matched=true) no mesmo período.
    const reconciledCount = await prisma.bankStatementTxn.count({
      where: { clientId, matched: true, ...(month ? { periodMonth: month } : {}) },
    });
    const totalTxn = rows.length + reconciledCount;
    const progressPct = totalTxn > 0 ? Math.round((reconciledCount / totalTxn) * 100) : 0;

    return NextResponse.json({
      ok: true,
      connected,
      applyEnabled: process.env.QBO_RECONCILE_ENABLED === '1',
      month: month || null,
      pending: rows.length,
      autoApplyCount,
      reviewCount,
      reconciledCount,
      totalTxn,
      progressPct,
      compliantCount,
      blockedCount,
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
    const body = (await req.json().catch(() => ({}))) as { month?: string; approve?: boolean; clientId?: string; markReconciled?: unknown; ids?: unknown; limit?: number };
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
    // ---- Caminho B: cria os lançamentos no QuickBooks (Purchase/Deposit) ----
    // Segurança: só grava linhas de ALTA confiança (autoApply), com conta contábil FL E conta
    // bancária resolvidas no plano real do cliente, e tipo purchase/deposit (transfers/journal ficam
    // de fora). `limit` permite testar com 1 antes de rodar o lote. `ids` restringe a transações
    // específicas. Cada lançamento criado é rastreado (matchedQboId) para auditoria/undo.
    const month = /^\d{4}-\d{2}$/.test(body.month || '') ? (body.month as string) : '';
    const onlyIds = Array.isArray(body.ids) ? (body.ids as unknown[]).map((x) => String(x || '')).filter(Boolean) : null;
    const limit = Number.isFinite(body.limit) && Number(body.limit) > 0 ? Math.min(Number(body.limit), 200) : 200;

    let accounts: QboAccountLite[] = [];
    try {
      accounts = (await qbListAccounts(scope.clientId)) as QboAccountLite[];
    } catch (e) {
      return NextResponse.json({ ok: false, error: 'Não consegui ler o plano de contas do QuickBooks: ' + (e instanceof Error ? e.message : 'erro') }, { status: 502 });
    }
    const mapRow = await prisma.qboReconcileMap.findUnique({ where: { clientId: scope.clientId } });
    const savedMap = (mapRow?.mapping as { cat?: Record<string, string>; bank?: Record<string, string> } | undefined) || {};
    const savedCat = savedMap.cat || {};
    const savedBank = savedMap.bank || {};

    // Anti-duplicação: só pega transações AINDA não conciliadas E sem lançamento QBO criado.
    const txns = await prisma.bankStatementTxn.findMany({
      where: { clientId: scope.clientId, matched: false, matchedQboId: null, ...(month ? { periodMonth: month } : {}), ...(onlyIds ? { id: { in: onlyIds } } : {}) },
      orderBy: [{ txnDate: 'asc' }],
      take: 500,
      select: { id: true, bankAccountKey: true, txnDate: true, description: true, amount: true },
    });

    const results: Array<{ id: string; ok: boolean; qboId?: string; type?: string; error?: string; skipped?: string }> = [];
    let created = 0, failed = 0, skipped = 0;

    for (const t of txns) {
      if (created >= limit) break;
      const amount = round2(Number(t.amount));
      const plan = flReconcilePlan(t.description, amount, t.bankAccountKey);
      // Só automa o que é seguro: alta confiança + purchase/deposit.
      if (!plan.autoApply || (plan.entryType !== 'purchase' && plan.entryType !== 'deposit')) {
        skipped++; results.push({ id: t.id, ok: false, skipped: 'baixa confiança / tipo não automatizável (' + plan.entryType + ')' });
        continue;
      }
      const flAcct = resolveQboAccount(plan, accounts, savedCat);
      const bankAcct = resolveQboBankAccount(t.bankAccountKey, accounts, savedBank);
      // TRAVA DE CONFORMIDADE FL — bloqueia qualquer lançamento fora do padrão trust accounting.
      const val = flValidateEntry(plan, flAcct, bankAcct, t.bankAccountKey, amount);
      if (!val.ok || !flAcct || !bankAcct) {
        skipped++; results.push({ id: t.id, ok: false, skipped: val.reason || 'conta não mapeada no QBO' });
        continue;
      }
      const txnDate = t.txnDate.toISOString().slice(0, 10);
      // memo com ref único (idempotência/rastreio): permite identificar duplicata no próprio QBO.
      const memo = `GodManager robô · ${plan.category} · ref:${t.id} · ${plan.rule.slice(0, 90)}`;
      try {
        let qboId = '', qboType = '';
        if (plan.entryType === 'deposit') {
          const r = await qbCreateDeposit(scope.clientId, { amount: Math.abs(amount), bankAccountId: bankAcct.id, fromAccountId: flAcct.id, txnDate, memo, description: t.description.slice(0, 200) });
          qboId = r.id; qboType = 'Deposit';
        } else {
          const r = await qbCreatePurchase(scope.clientId, { amount: Math.abs(amount), expenseAccountId: flAcct.id, paymentAccountId: bankAcct.id, paymentType: 'Check', txnDate, memo, description: t.description.slice(0, 200) });
          qboId = r.id; qboType = 'Purchase';
        }
        await prisma.bankStatementTxn.update({ where: { id: t.id }, data: { matched: true, matchedQboId: qboId, matchedQboType: qboType } });
        created++; results.push({ id: t.id, ok: true, qboId, type: qboType });
      } catch (e) {
        failed++; results.push({ id: t.id, ok: false, error: e instanceof Error ? e.message : 'erro ao criar no QBO' });
      }
    }

    // Auditoria interna: registra o que foi criado (com o ID do QBO) e os motivos de bloqueio.
    const createdList = results.filter((r) => r.ok).map((r) => `${r.type}#${r.qboId}`).join(',');
    const blockReasons = Array.from(new Set(results.filter((r) => r.skipped).map((r) => r.skipped))).slice(0, 8).join(' | ');
    await recordAudit({
      request: req, actor: { id: user.id, email: user.email },
      action: 'quickbooks.reconcile_robot_apply', entity: 'bank_statement_txn', entityId: scope.clientId, clientId: scope.clientId,
      details: `apply month=${month || 'all'} created=${created} failed=${failed} blocked=${skipped} limit=${limit} · criados=[${createdList}] · bloqueios=[${blockReasons}]`,
    });
    return NextResponse.json({ ok: true, created, failed, skipped, results });
  } catch (e) {
    console.error('[POST /api/quickbooks/reconcile-robot]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Falha no robô de conciliação.' }, { status: 500 });
  }
}
