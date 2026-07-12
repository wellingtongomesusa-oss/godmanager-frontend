import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ramp/match  { clientId?, transactions:[{id, merchant, amount, date}] }
 * Casa cada transação do Ramp com um PmExpense (job) pelo vendor + valor (+ data),
 * devolvendo a casa (property) e o mês. Serve para saber "de qual casa" veio o gasto.
 */

function norm(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\b(inc|llc|ltd|co|corp|company|services?|the)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

type TxIn = { id: string; merchant: string; amount: number; date: string };

export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { clientId?: string; transactions?: unknown };
  const scope = await resolveBankAccountClientScope(user, body?.clientId ?? null);
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

  const txs: TxIn[] = Array.isArray(body?.transactions)
    ? (body!.transactions as unknown[]).slice(0, 500).map((t) => {
        const o = t as Record<string, unknown>;
        return { id: String(o?.id || ''), merchant: String(o?.merchant || ''), amount: Number(o?.amount) || 0, date: String(o?.date || '') };
      }).filter((t) => t.id && t.amount > 0)
    : [];
  if (!txs.length) return NextResponse.json({ ok: true, matches: {} });

  // Carrega vendors + expenses do cliente + expenses já vinculados a um lançamento Ramp
  const [vendors, expensesAll, linked] = await Promise.all([
    prisma.pmVendor.findMany({ where: { clientId: scope.clientId }, select: { id: true, companyName: true } }),
    prisma.pmExpense.findMany({
      where: { clientId: scope.clientId, vendorId: { not: null } },
      select: {
        id: true, vendorId: true, vendorCost: true, serviceDate: true, monthRef: true, propertyId: true,
        property: { select: { address: true, code: true } },
      },
    }),
    prisma.rampExpensePosting.findMany({
      where: { clientId: scope.clientId, matchedExpenseId: { not: null } },
      select: { matchedExpenseId: true },
    }),
  ]);
  // exclui os já pagos via Ramp (não casar 2x)
  const usedExpenseIds = new Set(linked.map((l) => l.matchedExpenseId).filter(Boolean) as string[]);
  const expenses = expensesAll.filter((e) => !usedExpenseIds.has(e.id));

  const vendorNorm = new Map<string, string>(); // vendorId -> normalized name
  for (const v of vendors) vendorNorm.set(v.id, norm(v.companyName));

  // agrupa expenses por vendorId
  const byVendor = new Map<string, typeof expenses>();
  for (const e of expenses) {
    if (!e.vendorId) continue;
    const arr = byVendor.get(e.vendorId) || [];
    arr.push(e);
    byVendor.set(e.vendorId, arr);
  }

  type Cand = {
    expenseId: string; propertyId: string | null; propertyLabel: string; monthRef: string | null;
    amount: string; serviceDate: string | null; confidence: 'high' | 'medium' | 'low';
  };
  const matches: Record<string, {
    propertyId: string | null; propertyLabel: string; monthRef: string | null; expenseId: string;
    vendorName: string; confidence: 'high' | 'medium' | 'low'; candidates: Cand[];
  }> = {};

  for (const tx of txs) {
    const mn = norm(tx.merchant);
    if (!mn) continue;
    // acha vendor cujo nome normalizado casa (igual, contém ou é contido)
    const vendorId = [...vendorNorm.entries()].find(([, vn]) => vn && (vn === mn || vn.includes(mn) || mn.includes(vn)))?.[0];
    if (!vendorId) continue;
    const cands = byVendor.get(vendorId) || [];
    if (!cands.length) continue;

    const txDate = tx.date ? new Date(tx.date).getTime() : NaN;
    const scored = cands.map((e) => {
      const cost = Number(e.vendorCost) || 0;
      const amtDiff = Math.abs(cost - tx.amount);
      const amtMatch = amtDiff < 0.02;
      const amtClose = amtDiff <= Math.max(1, tx.amount * 0.02);
      let dayDiff = 999;
      if (!Number.isNaN(txDate) && e.serviceDate) dayDiff = Math.abs(txDate - e.serviceDate.getTime()) / 86400000;
      let conf: 'high' | 'medium' | 'low';
      let score: number;
      if (amtMatch && dayDiff <= 20) { conf = 'high'; score = 100 - dayDiff; }
      else if (amtMatch) { conf = 'medium'; score = 60; }
      else if (amtClose) { conf = 'medium'; score = 40 - amtDiff; }
      else { conf = 'low'; score = 10; }
      return { e, score, conf };
    }).sort((a, b) => b.score - a.score).slice(0, 6);

    if (!scored.length) continue;
    const toCand = (s: (typeof scored)[number]): Cand => ({
      expenseId: s.e.id,
      propertyId: s.e.propertyId,
      propertyLabel: s.e.property?.address || s.e.property?.code || '—',
      monthRef: s.e.monthRef || null,
      amount: Number(s.e.vendorCost).toFixed(2),
      serviceDate: s.e.serviceDate ? s.e.serviceDate.toISOString().slice(0, 10) : null,
      confidence: s.conf,
    });
    const candidates = scored.map(toCand);
    const top = candidates[0];
    matches[tx.id] = {
      propertyId: top.propertyId,
      propertyLabel: top.propertyLabel,
      monthRef: top.monthRef,
      expenseId: top.expenseId,
      vendorName: vendors.find((v) => v.id === vendorId)?.companyName || tx.merchant,
      confidence: top.confidence,
      candidates,
    };
  }

  return NextResponse.json({ ok: true, matches });
}
