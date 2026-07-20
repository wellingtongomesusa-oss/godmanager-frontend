import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { recordAudit } from '@/lib/auditServer';
import { pdfToLayoutText } from '@/lib/pdfTextLayout';
import { parseChaseStatement } from '@/lib/chaseStatementParser';
import { loadChaseMap, saveChaseMap } from '@/lib/chaseAccountMap';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/reconciliation/import-chase  (multipart: file=<PDF>, clientId?, map?=JSON)
 * Upload do extrato consolidado do Chase → extrai texto (unpdf), valida saldo por conta e faz
 * UPSERT em BankReconciliation (openingBalance/statementBalance) para cada conta/mês MAPEADA e com
 * saldo batendo. Não grava contas sem mapa ou com saldo divergente (retorna-as para o usuário mapear).
 * Idempotente. Restrito a admin/manager/super_admin.
 */
export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });

  try {
    const ct = req.headers.get('content-type') || '';
    if (!ct.includes('multipart/form-data')) {
      return NextResponse.json({ ok: false, error: 'Envie o PDF como multipart/form-data.' }, { status: 400 });
    }
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'Arquivo (file) ausente.' }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: 'Arquivo muito grande (máx 25MB).' }, { status: 413 });
    }

    const scope = await resolveBankAccountClientScope(user, (form.get('clientId') as string) || null);
    if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

    // Mapa conta→chave: salva override inline, se enviado.
    const mapRaw = form.get('map');
    if (typeof mapRaw === 'string' && mapRaw.trim()) {
      try { await saveChaseMap(scope.clientId, JSON.parse(mapRaw)); } catch { /* ignora json inválido */ }
    }
    const accountMap = await loadChaseMap(scope.clientId);

    // Extrai e parseia.
    let text: string;
    try {
      text = await pdfToLayoutText(new Uint8Array(await file.arrayBuffer()));
    } catch (e) {
      console.error('[import-chase] pdf extract', e instanceof Error ? e.message : e);
      return NextResponse.json({ ok: false, error: 'Não consegui ler este PDF.' }, { status: 422 });
    }
    const st = parseChaseStatement(text);
    if (!st.periodMonth || !st.accounts.length) {
      return NextResponse.json({ ok: false, error: 'Não parece um extrato Chase reconhecível (sem período/contas).' }, { status: 422 });
    }

    const imported: Array<{ last4: string; bankAccountKey: string; opening: number; ending: number; txns: number }> = [];
    const unmapped: Array<{ last4: string; opening: number; ending: number; txns: number }> = [];
    const unbalanced: Array<{ last4: string; diff: number }> = [];

    for (const a of st.accounts) {
      if (!a.balanced) { unbalanced.push({ last4: a.last4, diff: a.diff }); continue; }
      const key = accountMap[a.last4];
      if (!key) { unmapped.push({ last4: a.last4, opening: a.beginningBalance, ending: a.endingBalance, txns: a.transactions.length }); continue; }

      await prisma.bankReconciliation.upsert({
        where: { clientId_bankAccountKey_periodMonth: { clientId: scope.clientId, bankAccountKey: key, periodMonth: st.periodMonth } },
        create: {
          clientId: scope.clientId, bankAccountKey: key, periodMonth: st.periodMonth,
          openingBalance: new Prisma.Decimal(a.beginningBalance),
          statementBalance: new Prisma.Decimal(a.endingBalance),
          notes: `Importado do extrato Chase (conta …${a.last4}).`,
          createdById: user.id,
        },
        update: {
          openingBalance: new Prisma.Decimal(a.beginningBalance),
          statementBalance: new Prisma.Decimal(a.endingBalance),
        },
      });

      // Transações do banco (lado banco). Idempotente: remove as ainda-não-conferidas e recria;
      // preserva as já marcadas como conferidas (matched) via skipDuplicates no sourceRefId.
      await prisma.bankStatementTxn.deleteMany({
        where: { clientId: scope.clientId, bankAccountKey: key, periodMonth: st.periodMonth, matched: false },
      });
      const rows = a.transactions.map((t, i) => ({
        clientId: scope.clientId,
        bankAccountKey: key,
        periodMonth: st.periodMonth as string,
        txnDate: new Date(t.date + 'T00:00:00Z'),
        description: t.description.slice(0, 400),
        amount: new Prisma.Decimal(t.amount),
        section: t.section,
        sourceRefId: `${key}:${st.periodMonth}:${i}`,
      }));
      if (rows.length) await prisma.bankStatementTxn.createMany({ data: rows, skipDuplicates: true });

      imported.push({ last4: a.last4, bankAccountKey: key, opening: a.beginningBalance, ending: a.endingBalance, txns: a.transactions.length });
    }

    if (imported.length) {
      await recordAudit({
        request: req, actor: { id: user.id, email: user.email },
        action: 'reconciliation.import_chase', entity: 'bank_reconciliation', entityId: st.periodMonth,
        clientId: scope.clientId,
        details: `Chase ${st.periodMonth}: ${imported.map((i) => `${i.bankAccountKey}=${i.ending}`).join(', ')}`,
      });
    }

    return NextResponse.json({
      ok: true,
      periodMonth: st.periodMonth,
      periodStart: st.periodStart,
      periodEnd: st.periodEnd,
      imported,
      unmapped,
      unbalanced,
      accountMap,
    });
  } catch (e) {
    console.error('[POST /api/reconciliation/import-chase]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Falha ao importar o extrato.' }, { status: 500 });
  }
}
