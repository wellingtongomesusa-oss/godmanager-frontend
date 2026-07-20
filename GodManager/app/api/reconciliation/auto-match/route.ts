import { NextResponse } from 'next/server';
import { csrfGuard } from '@/lib/csrfGuard';
import { rateLimitGuard } from '@/lib/apiRateLimit';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const ACCOUNT_KEYS = ['TRUST_CHASE', 'OPERATING_TRUST', 'DEPOSIT_SECURITY'];
const cents = (n: number) => Math.round(n * 100);

/**
 * POST /api/reconciliation/auto-match  { bankAccountKey, periodMonth, clientId? }
 * Casa automaticamente, por VALOR (1-para-1), cada transação do extrato ainda não conferida com um
 * item de livro ainda não compensado de MESMO valor. Marca o item como cleared e a transação como
 * matched. Não move dinheiro; só marca. Idempotente (roda de novo sem duplicar).
 */
export async function POST(req: Request) {
  const bad = csrfGuard(req);
  if (bad) return bad;
  const rl = rateLimitGuard(req);
  if (rl) return rl;
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });

  try {
    const body = (await req.json().catch(() => ({}))) as { bankAccountKey?: string; periodMonth?: string; clientId?: string };
    const bankAccountKey = String(body?.bankAccountKey || '').trim().toUpperCase();
    const periodMonth = String(body?.periodMonth || '').trim();
    if (!ACCOUNT_KEYS.includes(bankAccountKey)) return NextResponse.json({ ok: false, error: 'bankAccountKey inválido.' }, { status: 400 });
    if (!YEAR_MONTH.test(periodMonth)) return NextResponse.json({ ok: false, error: 'periodMonth inválido (YYYY-MM).' }, { status: 400 });

    const scope = await resolveBankAccountClientScope(user, body?.clientId ?? null);
    if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

    const rec = await prisma.bankReconciliation.findUnique({
      where: { clientId_bankAccountKey_periodMonth: { clientId: scope.clientId, bankAccountKey, periodMonth } },
      include: { items: { where: { cleared: false }, select: { id: true, amount: true } } },
    });
    const bankTxns = await prisma.bankStatementTxn.findMany({
      where: { clientId: scope.clientId, bankAccountKey, periodMonth, matched: false },
      select: { id: true, amount: true },
    });

    if (!rec || !rec.items.length || !bankTxns.length) {
      return NextResponse.json({ ok: true, matched: 0, bankTxns: bankTxns.length, bookOpen: rec?.items.length || 0 });
    }

    // Pool de itens de livro não compensados, por valor (centavos). Cada item usado uma vez só.
    const pool = rec.items.map((it) => ({ id: it.id, c: cents(Number(it.amount)), used: false }));
    const pairs: Array<{ txnId: string; itemId: string }> = [];
    for (const t of bankTxns) {
      const tc = cents(Number(t.amount));
      const hit = pool.find((p) => !p.used && p.c === tc);
      if (hit) { hit.used = true; pairs.push({ txnId: t.id, itemId: hit.id }); }
    }

    if (pairs.length) {
      await prisma.$transaction([
        ...pairs.map((p) => prisma.bankReconciliationItem.update({ where: { id: p.itemId }, data: { cleared: true } })),
        ...pairs.map((p) => prisma.bankStatementTxn.update({ where: { id: p.txnId }, data: { matched: true, matchedItemId: p.itemId } })),
      ]);
      await recordAudit({
        request: req, actor: { id: user.id, email: user.email },
        action: 'reconciliation.auto_match', entity: 'bank_reconciliation', entityId: rec.id,
        clientId: scope.clientId, details: `${bankAccountKey} ${periodMonth}: ${pairs.length} casado(s) por valor`,
      });
    }

    return NextResponse.json({
      ok: true,
      matched: pairs.length,
      remainingBankTxns: bankTxns.length - pairs.length,
      remainingBookItems: pool.filter((p) => !p.used).length,
    });
  } catch (e) {
    console.error('[POST /api/reconciliation/auto-match]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Falha ao casar automaticamente.' }, { status: 500 });
  }
}
