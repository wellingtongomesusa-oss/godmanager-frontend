import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { CHASE_TXN_TYPES, categorizeChaseTxn } from '@/lib/chaseTxnCategory';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

const round2 = (n: number) => Math.round(n * 100) / 100;
const ACCOUNTS = ['TRUST_CHASE', 'OPERATING_TRUST', 'DEPOSIT_SECURITY'];

/**
 * GET /api/bank-accounts/txn-summary?account=&month=&q=
 * Cards de transações por TIPO (Zelle/ACH/Wire/…), tendência mensal (entradas/saídas) para o
 * gráfico, e a lista de transações filtrável (busca). Somente leitura (BankStatementTxn).
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  void recordAudit({ request: req, actor: { id: user.id, email: user.email }, action: 'bank_data.access', entity: 'bank_data', entityId: 'txn-summary' });
  try {
    const url = new URL(req.url);
    const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
    if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
    const clientId = scope.clientId;

    const accParam = String(url.searchParams.get('account') || '').toUpperCase();
    const account = ACCOUNTS.includes(accParam) ? accParam : '';
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();

    const accWhere = account ? { bankAccountKey: account } : {};

    // meses disponíveis
    const monthsRows = await prisma.bankStatementTxn.findMany({
      where: { clientId, ...accWhere },
      distinct: ['periodMonth'],
      orderBy: { periodMonth: 'desc' },
      select: { periodMonth: true },
    });
    const months = monthsRows.map((r) => r.periodMonth);
    const monthParam = String(url.searchParams.get('month') || '');
    const month = /^\d{4}-\d{2}$/.test(monthParam) && months.includes(monthParam) ? monthParam : months[0] || '';

    // transações do mês selecionado (para cards por tipo + lista)
    const txns = month
      ? await prisma.bankStatementTxn.findMany({
          where: { clientId, ...accWhere, periodMonth: month },
          orderBy: { txnDate: 'asc' },
          select: { bankAccountKey: true, txnDate: true, description: true, amount: true, section: true },
        })
      : [];

    const byType: Record<string, { in: number; out: number; count: number }> = {};
    for (const t of CHASE_TXN_TYPES) byType[t] = { in: 0, out: 0, count: 0 };
    let entradas = 0, saidas = 0;
    for (const t of txns) {
      const amt = Number(t.amount);
      const cat = categorizeChaseTxn(t.description);
      byType[cat].count += 1;
      if (amt >= 0) { entradas += amt; byType[cat].in += amt; } else { saidas += Math.abs(amt); byType[cat].out += Math.abs(amt); }
    }
    const cards = CHASE_TXN_TYPES.map((t) => ({ type: t, in: round2(byType[t].in), out: round2(byType[t].out), count: byType[t].count }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.in + b.out - (a.in + a.out));

    // tendência mensal (todos os meses) para o gráfico de evolução/involução
    const allTxns = await prisma.bankStatementTxn.findMany({
      where: { clientId, ...accWhere },
      select: { periodMonth: true, amount: true, description: true },
    });
    const trendMap = new Map<string, { in: number; out: number }>();
    const typeTrend = new Map<string, Map<string, { in: number; out: number }>>();
    for (const t of allTxns) {
      const amt = Number(t.amount);
      const cur = trendMap.get(t.periodMonth) || { in: 0, out: 0 };
      if (amt >= 0) cur.in += amt; else cur.out += Math.abs(amt);
      trendMap.set(t.periodMonth, cur);
      const cat = categorizeChaseTxn(t.description);
      const tt = typeTrend.get(cat) || new Map();
      const c2 = tt.get(t.periodMonth) || { in: 0, out: 0 };
      if (amt >= 0) c2.in += amt; else c2.out += Math.abs(amt);
      tt.set(t.periodMonth, c2);
      typeTrend.set(cat, tt);
    }
    const trend = [...trendMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([m, v]) => ({ month: m, in: round2(v.in), out: round2(v.out) }));
    const trendByType: Record<string, { month: string; in: number; out: number }[]> = {};
    for (const [type, mp] of typeTrend) {
      trendByType[type] = [...mp.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([m, v]) => ({ month: m, in: round2(v.in), out: round2(v.out) }));
    }

    // lista de transações do mês (filtrada pela busca)
    const list = txns
      .map((t) => ({ account: t.bankAccountKey, date: t.txnDate.toISOString().slice(0, 10), description: t.description, amount: round2(Number(t.amount)), section: t.section, type: categorizeChaseTxn(t.description) }))
      .filter((t) => (!q ? true : (t.description + ' ' + t.type + ' ' + t.account).toLowerCase().includes(q)));

    return NextResponse.json({
      ok: true, account: account || 'ALL', month, months,
      totals: { entradas: round2(entradas), saidas: round2(saidas), count: txns.length },
      cards, trend, trendByType, transactions: list.slice(0, 600), transactionCount: list.length,
    });
  } catch (e) {
    console.error('[GET /api/bank-accounts/txn-summary]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Falha ao resumir transações.' }, { status: 500 });
  }
}
