import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { monthRefToCycleRange } from '@/lib/pmCycleRef';

export const dynamic = 'force-dynamic';

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const round2 = (n: number) => Math.round(n * 100) / 100;
const cents = (n: number) => Math.round(n * 100);

/** Tokens significativos de um nome (para casar o beneficiário do GL com a descrição do banco). */
function nameTokens(s: string): string[] {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 4);
}
function nameScore(payee: string, bankDesc: string): number {
  const d = String(bankDesc || '').toLowerCase();
  const toks = nameTokens(payee);
  if (!toks.length) return 0;
  return toks.filter((t) => d.includes(t)).length;
}

/**
 * GET /api/owner-statement/gl-bank-match?periodMonth=YYYY-MM[&clientId=]
 * Concilia os repasses ao owner do GL (3250, kind=SENT) com as SAÍDAS do extrato do Chase
 * (BankStatementTxn, amount<0), por valor + proximidade de data + nome do beneficiário. Somente
 * leitura. Mostra: casados, no GL sem saída no banco, e saídas do banco de mesmo valor não usadas.
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  try {
    const url = new URL(req.url);
    const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
    if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

    const periodMonth = (url.searchParams.get('periodMonth') || '').trim();
    if (!YEAR_MONTH.test(periodMonth)) {
      return NextResponse.json({ ok: false, error: 'periodMonth inválido (YYYY-MM).' }, { status: 400 });
    }
    const range = monthRefToCycleRange(periodMonth);
    if (!range) return NextResponse.json({ ok: false, error: 'periodMonth inválido.' }, { status: 400 });

    // Repasses do GL (3250) do ciclo.
    const glSent = await prisma.propertyGlTxn.findMany({
      where: { clientId: scope.clientId, periodMonth, kind: 'SENT' },
      select: { id: true, txnDate: true, amount: true, payerPayee: true, propertyLabel: true, description: true },
      orderBy: { txnDate: 'asc' },
    });

    // Saídas do banco numa janela em volta do ciclo (±10 dias), qualquer conta trust.
    const winStart = new Date(range.start.getTime() - 10 * 86400000);
    const winEnd = new Date(range.end.getTime() + 10 * 86400000);
    const bankOut = await prisma.bankStatementTxn.findMany({
      where: { clientId: scope.clientId, amount: { lt: 0 }, txnDate: { gte: winStart, lte: winEnd } },
      select: { id: true, txnDate: true, amount: true, bankAccountKey: true, description: true },
    });
    const pool = bankOut.map((b) => ({
      id: b.id,
      date: b.txnDate,
      c: cents(Math.abs(Number(b.amount))),
      key: b.bankAccountKey,
      desc: b.description,
      used: false,
    }));

    const matched: unknown[] = [];
    const glUnmatched: unknown[] = [];

    for (const g of glSent) {
      const gc = cents(Number(g.amount));
      const gt = g.txnDate.getTime();
      const cands = pool.filter((p) => !p.used && p.c === gc);
      let best: (typeof pool)[number] | null = null;
      let bestScore = -1;
      for (const c of cands) {
        const ns = nameScore(g.payerPayee || '', c.desc);
        const dayDiff = Math.abs(c.date.getTime() - gt) / 86400000;
        const score = ns * 100 - dayDiff; // nome pesa mais; empate → data mais próxima
        if (score > bestScore) { bestScore = score; best = c; }
      }
      if (best) {
        best.used = true;
        matched.push({
          gl: { date: g.txnDate.toISOString().slice(0, 10), owner: g.payerPayee || '', property: g.propertyLabel, amount: round2(Number(g.amount)) },
          bank: { date: best.date.toISOString().slice(0, 10), account: best.key, description: best.desc },
          nameMatch: nameScore(g.payerPayee || '', best.desc) > 0,
        });
      } else {
        glUnmatched.push({ date: g.txnDate.toISOString().slice(0, 10), owner: g.payerPayee || '', property: g.propertyLabel, amount: round2(Number(g.amount)) });
      }
    }

    // Saídas do banco de mesmo valor que NÃO foram usadas por nenhum repasse (informativo, limitado).
    const bankUnused = pool
      .filter((p) => !p.used)
      .filter((p) => glSent.some((g) => cents(Number(g.amount)) === p.c))
      .slice(0, 50)
      .map((p) => ({ date: p.date.toISOString().slice(0, 10), account: p.key, amount: round2(p.c / 100), description: p.desc }));

    const sum = (arr: { amount: number }[]) => round2(arr.reduce((s, x) => s + x.amount, 0));
    return NextResponse.json({
      ok: true,
      periodMonth,
      totals: {
        glCount: glSent.length,
        matchedCount: matched.length,
        matchedValue: sum(matched.map((m) => ({ amount: (m as { gl: { amount: number } }).gl.amount }))),
        glUnmatchedCount: glUnmatched.length,
        glUnmatchedValue: sum(glUnmatched as { amount: number }[]),
      },
      matched,
      glUnmatched,
      bankUnused,
    });
  } catch (e) {
    console.error('[GET /api/owner-statement/gl-bank-match]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Falha ao conciliar GL × banco.' }, { status: 500 });
  }
}
