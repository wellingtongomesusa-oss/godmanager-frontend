/**
 * Parser do GENERAL LEDGER COMPLETO do AppFolio (todas as contas), por seção de conta.
 *
 * O CSV vem agrupado por conta: linhas de cabeçalho "-> 4100 - Rent Income" iniciam uma
 * seção; as linhas seguintes pertencem àquela conta até o próximo "-> ...".
 *
 * Classificação (padrão AppFolio / US GAAP simplificado):
 *   4xxx = Receita (Income)      → valor = Credit - Debit
 *   6xxx / 7xxx = Despesa        → valor = Debit - Credit
 *   6111 = Management Fees (mgmt fee real cobrado)
 *   1xxx = Ativo (caixa/depósito) · 2xxx = Passivo (depósitos retidos/prepaid) · 3xxx = Equity
 *
 * Puro: sem dependência de banco.
 */

export type GlKind = 'income' | 'expense' | 'asset' | 'liability' | 'equity' | 'other';

export interface FullGlRow {
  accountCode: string; // '4100'
  accountName: string; // 'Rent Income'
  kind: GlKind;
  isMgmtFee: boolean; // conta 6111
  propertyRaw: string;
  propertyShort: string;
  date: string; // MM/DD/YYYY
  month: string; // 'YYYY-MM'
  debit: number;
  credit: number;
  signed: number; // income: credit-debit ; expense: debit-credit ; senão credit-debit
  description: string;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function amt(raw: string | undefined): number {
  if (!raw) return 0;
  const n = parseFloat(String(raw).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function kindOf(code: string): GlKind {
  const c = code[0];
  if (c === '4') return 'income';
  if (c === '6' || c === '7') return 'expense';
  if (c === '1') return 'asset';
  if (c === '2') return 'liability';
  if (c === '3') return 'equity';
  return 'other';
}

/** Parse do GL completo → linhas classificadas por conta. */
export function parseFullGeneralLedger(csv: string): FullGlRow[] {
  const lines = String(csv || '').split(/\r?\n/);
  const rows: FullGlRow[] = [];
  let curCode = '';
  let curName = '';

  for (const line of lines) {
    if (!line.trim()) continue;
    const f = parseCsvLine(line);
    const first = (f[0] || '').trim();

    // cabeçalho de conta: "-> 4100 - Rent Income"
    const secMatch = first.match(/^->\s*(\d{3,5})\s*-\s*(.+)$/);
    if (secMatch) {
      curCode = secMatch[1];
      curName = secMatch[2].trim();
      continue;
    }
    if (!first || first === 'Property' || first === 'Starting Balance' || first === 'Total') continue;

    const m = (f[1] || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) continue;
    if (!curCode) continue;

    const debit = amt(f[5]);
    const credit = amt(f[6]);
    if (debit === 0 && credit === 0) continue;

    const kind = kindOf(curCode);
    const signed =
      kind === 'expense' ? debit - credit : credit - debit; // income/others: credit-debit

    rows.push({
      accountCode: curCode,
      accountName: curName,
      kind,
      isMgmtFee: curCode === '6111',
      propertyRaw: first,
      propertyShort: first.split(' - ')[0].trim(),
      date: (f[1] || '').trim(),
      month: `${m[3]}-${m[1]}`,
      debit,
      credit,
      signed,
      description: (f[8] || '').trim(),
    });
  }
  return rows;
}

export interface PropertyMonthPnl {
  propertyShort: string;
  month: string;
  income: number;
  expenses: number;
  mgmtFee: number;
  net: number; // income - expenses  (lucro do owner antes de repasses/depósitos)
  byCategory: Record<string, number>; // accountName -> signed sum (income + / expense -)
}

/** Normaliza chave da casa (igual às outras libs). */
export function normPropKey(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[.,#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Agrega P&L por (casa, mês): receita, despesa, mgmt fee, líquido, e por categoria. */
export function aggregatePropertyMonthPnl(rows: FullGlRow[]): PropertyMonthPnl[] {
  const map = new Map<string, PropertyMonthPnl>();
  for (const r of rows) {
    if (r.kind !== 'income' && r.kind !== 'expense') continue; // P&L só income/expense
    const key = normPropKey(r.propertyShort) + '|' + r.month;
    let p = map.get(key);
    if (!p) {
      p = {
        propertyShort: r.propertyShort,
        month: r.month,
        income: 0,
        expenses: 0,
        mgmtFee: 0,
        net: 0,
        byCategory: {},
      };
      map.set(key, p);
    }
    if (r.kind === 'income') p.income += r.signed;
    else {
      p.expenses += r.signed;
      if (r.isMgmtFee) p.mgmtFee += r.signed;
    }
    p.byCategory[r.accountName] = (p.byCategory[r.accountName] || 0) + r.signed;
  }
  const out = [...map.values()];
  out.forEach((p) => {
    p.income = Math.round(p.income * 100) / 100;
    p.expenses = Math.round(p.expenses * 100) / 100;
    p.mgmtFee = Math.round(p.mgmtFee * 100) / 100;
    p.net = Math.round((p.income - p.expenses) * 100) / 100;
  });
  return out;
}
