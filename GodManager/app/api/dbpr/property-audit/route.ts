import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { coaLookup } from '@/lib/appfolioCoa';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dbpr/property-audit  — Audit Center (one-pager Propriedade → Mês)
 *
 * Somente leitura. Reusa o GLEntry (transação AppFolio já importada: accountCode, account, debit,
 * credit, payee, reference, description, entryDate, propertyId/propertyAddress, glImportId/txnHash).
 * NÃO cria nada, NÃO altera dados. Escopo por clientId (resolveBankAccountClientScope), como o
 * Estudo do GL. Responde à pergunta central: "o que aconteceu financeiramente com esta casa neste mês?"
 *
 * Modos:
 *   (sem property)                 → lista de casas com totais (para a busca/seleção)
 *   ?property=<key>&year=YYYY      → resumo mensal daquela casa (cards por mês)
 *   ?property=<key>&year&month=MM  → transações + quebra por GL do mês (drill-down)
 *
 * `property` (key) = propertyId quando a casa está casada, senão `addr:<propertyAddress>` (a casa
 * pode não ter propertyId, mas o propertyAddress do AppFolio é sempre preservado).
 *
 * Convenção de sinais (preserva debit/credit originais; ver DBPR spec §74):
 *   Receita (4xxx)  = credit − debit
 *   Despesa (6xxx)  = debit − credit
 *   Owner dist 3250 = debit − credit  (saída ao proprietário)
 *   Security dep 21xx = credit − debit (recebido +, devolvido −)  — passivo, nunca receita
 *   Caixa 1xxx      = debit − credit  (perna de caixa — fora do "Net Property Activity")
 */

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

type Cat =
  | 'rent' | 'delinquency' | 'late_fee' | 'renewal' | 'other_revenue'
  | 'mgmt_fee' | 'expense'
  | 'owner_dist' | 'security_deposit' | 'cash' | 'other';

/**
 * Categoriza um GL pelo accountCode usando a COA autoritativa do AppFolio (lib/appfolioCoa).
 * Códigos específicos primeiro; senão pelo Account Type da COA; fallback por prefixo se o código
 * não estiver na COA (aí a transação também é marcada como UNKNOWN GL na resposta).
 * Importante (corrige heurística antiga): 2200 = Prepaid Rent (Liability, NÃO caução/receita);
 * 18xx = CapEx/Asset (fora do resultado operacional); só 2101–2105 são security deposit.
 */
function glCategory(code: string): Cat {
  const c = String(code || '').trim();
  if (c === '4100') return 'rent';
  if (c === '4220') return 'delinquency';
  if (c === '4460') return 'late_fee';
  if (c === '4860') return 'renewal';
  if (c === '6111') return 'mgmt_fee';
  if (c === '3250') return 'owner_dist';
  const coa = coaLookup(c);
  if (coa) {
    const t = coa.type;
    if (t === 'Income') return 'other_revenue';
    if (t === 'Expense') return 'expense';
    if (t === 'Liability') return /^210[1-5]$/.test(c) ? 'security_deposit' : 'other';
    if (t === 'Cash') return 'cash';
    return 'other'; // Capital (3xxx), Asset/CapEx (18xx) — fora do net operacional
  }
  // Fallback: código fora da COA (será sinalizado como UNKNOWN GL)
  if (/^4/.test(c)) return 'other_revenue';
  if (/^6/.test(c)) return 'expense';
  if (/^210[1-5]$/.test(c)) return 'security_deposit';
  if (/^1/.test(c)) return 'cash';
  return 'other';
}
const isRevenue = (cat: Cat) =>
  cat === 'rent' || cat === 'delinquency' || cat === 'late_fee' || cat === 'renewal' || cat === 'other_revenue';

/** Valor "analítico" com sinal correto por categoria (não altera debit/credit originais). */
function signedAmount(cat: Cat, debit: number, credit: number): number {
  if (isRevenue(cat) || cat === 'security_deposit') return credit - debit;
  // despesa, mgmt fee, owner dist, cash, other
  return debit - credit;
}

const propKey = (propertyId: string | null, propertyAddress: string) =>
  propertyId ? propertyId : `addr:${propertyAddress}`;

export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  try {
    const url = new URL(req.url);
    const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
    if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
    const clientId = scope.clientId;

    const property = (url.searchParams.get('property') || '').trim();
    const year = /^\d{4}$/.test(url.searchParams.get('year') || '') ? url.searchParams.get('year') : '';
    const month = /^\d{2}$/.test(url.searchParams.get('month') || '') ? url.searchParams.get('month') : '';

    // ---------- MODO LISTA: casas com totais (para busca/seleção) ----------
    if (!property) {
      const rows = await prisma.gLEntry.findMany({
        where: { clientId },
        select: { propertyId: true, propertyAddress: true, accountCode: true, debit: true, credit: true, entryDate: true },
      });
      type Agg = { key: string; propertyId: string | null; address: string; txnCount: number; revenue: number; expenses: number; first: string; last: string };
      const byProp = new Map<string, Agg>();
      for (const r of rows) {
        const key = propKey(r.propertyId, r.propertyAddress);
        const a = byProp.get(key) || { key, propertyId: r.propertyId, address: r.propertyAddress, txnCount: 0, revenue: 0, expenses: 0, first: '', last: '' };
        const cat = glCategory(r.accountCode || '');
        const d = num(r.debit), c = num(r.credit);
        if (isRevenue(cat)) a.revenue += c - d;
        else if (cat === 'expense' || cat === 'mgmt_fee') a.expenses += d - c;
        a.txnCount += 1;
        const day = r.entryDate.toISOString().slice(0, 10);
        if (!a.first || day < a.first) a.first = day;
        if (!a.last || day > a.last) a.last = day;
        byProp.set(key, a);
      }
      const properties = [...byProp.values()]
        .map((a) => ({ ...a, revenue: round2(a.revenue), expenses: round2(a.expenses), net: round2(a.revenue - a.expenses) }))
        .sort((x, y) => y.revenue - x.revenue);
      return NextResponse.json({ ok: true, mode: 'list', count: properties.length, properties });
    }

    // ---------- MODO CASA: resolve a casa e lê as transações dela ----------
    const isId = !property.startsWith('addr:');
    const address = property.startsWith('addr:') ? property.slice(5) : '';
    const where = {
      clientId,
      ...(isId ? { propertyId: property } : { propertyId: null, propertyAddress: address }),
    };
    const entries = await prisma.gLEntry.findMany({
      where,
      orderBy: [{ entryDate: 'asc' }],
      select: {
        id: true, propertyId: true, propertyAddress: true, entryDate: true, entryType: true,
        payee: true, reference: true, description: true, account: true, accountCode: true,
        debit: true, credit: true, balance: true, glImportId: true, txnHash: true,
      },
    });

    if (!entries.length) {
      return NextResponse.json({ ok: true, mode: 'property', property: { key: property }, header: null, years: [], months: [], note: 'Sem transações no GL para esta casa.' });
    }

    // Cabeçalho da casa (nome/código/owner) quando casada com Property.
    let header: { key: string; name: string; address: string; code: string; ownerName: string | null; matched: boolean } = {
      key: property, name: entries[0].propertyAddress, address: entries[0].propertyAddress, code: '', ownerName: null, matched: false,
    };
    if (isId) {
      const p = await prisma.property.findFirst({
        where: { id: property, clientId },
        select: { code: true, address: true, owner: { select: { name: true } } },
      });
      if (p) header = { key: property, name: p.address || header.name, address: p.address || header.address, code: p.code || '', ownerName: p.owner?.name || null, matched: true };
    }

    // Fonte dos arquivos (rastreabilidade): glImportId → filename.
    const importIds = [...new Set(entries.map((e) => e.glImportId))];
    const imports = await prisma.gLImport.findMany({ where: { id: { in: importIds } }, select: { id: true, filename: true } });
    const fileById = new Map(imports.map((i) => [i.id, i.filename]));

    // Agrega por mês (YYYY-MM) usando a data da transação.
    type MB = { rent: number; delinquency: number; lateFee: number; renewal: number; otherRevenue: number; expenses: number; mgmtFee: number; ownerDist: number; securityDeposit: number; txnCount: number };
    const mk = (): MB => ({ rent: 0, delinquency: 0, lateFee: 0, renewal: 0, otherRevenue: 0, expenses: 0, mgmtFee: 0, ownerDist: 0, securityDeposit: 0, txnCount: 0 });
    const byMonth = new Map<string, MB>();
    const yearsSet = new Set<string>();

    for (const e of entries) {
      const ym = e.entryDate.toISOString().slice(0, 7); // YYYY-MM
      yearsSet.add(ym.slice(0, 4));
      const b = byMonth.get(ym) || mk();
      const cat = glCategory(e.accountCode || '');
      const d = num(e.debit), c = num(e.credit);
      const v = signedAmount(cat, d, c);
      if (cat === 'rent') b.rent += v;
      else if (cat === 'delinquency') b.delinquency += v;
      else if (cat === 'late_fee') b.lateFee += v;
      else if (cat === 'renewal') b.renewal += v;
      else if (cat === 'other_revenue') b.otherRevenue += v;
      else if (cat === 'mgmt_fee') { b.mgmtFee += v; b.expenses += v; }
      else if (cat === 'expense') b.expenses += v;
      else if (cat === 'owner_dist') b.ownerDist += v;
      else if (cat === 'security_deposit') b.securityDeposit += v;
      b.txnCount += 1;
      byMonth.set(ym, b);
    }

    const months = [...byMonth.entries()]
      .filter(([ym]) => (year ? ym.startsWith(year) : true))
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ym, b]) => {
        const revenue = b.rent + b.delinquency + b.lateFee + b.renewal + b.otherRevenue;
        return {
          month: ym,
          rent: round2(b.rent), delinquency: round2(b.delinquency), lateFee: round2(b.lateFee),
          renewal: round2(b.renewal), otherRevenue: round2(b.otherRevenue),
          revenue: round2(revenue), expenses: round2(b.expenses), mgmtFee: round2(b.mgmtFee),
          ownerDist: round2(b.ownerDist), securityDeposit: round2(b.securityDeposit),
          net: round2(revenue - b.expenses), // Net Property Activity (operacional; exclui owner dist / caução)
          txnCount: b.txnCount,
        };
      });

    // ---------- Drill-down do mês: transações + quebra por GL ----------
    let transactions: unknown[] | undefined;
    let categories: unknown[] | undefined;
    let unknownGlCount = 0;
    if (year && month) {
      const ym = `${year}-${month}`;
      const monthRows = entries.filter((e) => e.entryDate.toISOString().slice(0, 7) === ym);
      transactions = monthRows.map((e) => {
        const code = e.accountCode || '';
        const cat = glCategory(code);
        const coa = coaLookup(code);
        const d = num(e.debit), c = num(e.credit);
        return {
          id: e.id,
          date: e.entryDate.toISOString().slice(0, 10),
          glCode: code, glName: coa ? coa.name : (e.account || ''), accountType: coa ? coa.type : null,
          category: cat, unknownGl: !coa && !!code,
          type: e.entryType, payee: e.payee || '', reference: e.reference || '',
          description: e.description || '',
          debit: d || null, credit: c || null, balance: e.balance != null ? num(e.balance) : null,
          net: round2(signedAmount(cat, d, c)),
          sourceFile: fileById.get(e.glImportId) || '', sourceRef: e.txnHash,
        };
      });
      unknownGlCount = (transactions as Array<{ unknownGl?: boolean }>).filter((t) => t.unknownGl).length;
      const catAgg = new Map<string, { glCode: string; glName: string; accountType: string | null; category: Cat; amount: number; count: number }>();
      for (const e of monthRows) {
        const code = e.accountCode || '';
        const cat = glCategory(code);
        const coa = coaLookup(code);
        const key = code || '(sem GL)';
        const g = catAgg.get(key) || { glCode: code, glName: coa ? coa.name : (e.account || ''), accountType: coa ? coa.type : null, category: cat, amount: 0, count: 0 };
        g.amount += signedAmount(cat, num(e.debit), num(e.credit));
        g.count += 1;
        catAgg.set(key, g);
      }
      categories = [...catAgg.values()].map((g) => ({ ...g, amount: round2(g.amount) })).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    }

    return NextResponse.json({
      ok: true, mode: 'property', property: { key: property },
      header, years: [...yearsSet].sort(), months,
      ...(transactions ? { month: `${year}-${month}`, transactions, categories, unknownGlCount } : {}),
    });
  } catch (e) {
    console.error('[GET /api/dbpr/property-audit]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Falha ao montar a auditoria da propriedade.' }, { status: 500 });
  }
}
