/**
 * Parser do "General Ledger" exportado do AppFolio (CSV) — foco nos pagamentos de
 * aluguel (Rent Income). Puro: sem dependência de banco.
 *
 * Formato:
 *   Property,Date,Payee / Payer,Type,Reference,Debit,Credit,Balance,Description
 *   -> 4100 - Rent Income,...                      (cabeçalho de conta GL)
 *   Starting Balance,,,,,,,0.00,
 *   "5160 Conroy Road - 5160 Conroy Road #1418 Orlando, FL 32811",01/01/2026,Thiago,Receipt,,,"1,650.00","-1,650.00",Rent
 *
 * Pagamento recebido = coluna Credit > 0. O valor no Debit seria estorno/saída.
 */

export interface GlPayment {
  propertyRaw: string; // "5160 Conroy Road - 5160 Conroy Road #1418 Orlando, FL 32811"
  propertyShort: string; // "5160 Conroy Road"
  payer: string;
  date: string; // MM/DD/YYYY
  month: string; // 'YYYY-MM'
  credit: number;
  description: string;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseAmount(raw: string | undefined): number {
  if (!raw) return 0;
  const n = parseFloat(String(raw).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

/** Extrai os pagamentos (Credit > 0) do GL. */
export function parseGeneralLedgerPayments(csv: string): GlPayment[] {
  const lines = String(csv || '').split(/\r?\n/);
  const rows: GlPayment[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const f = parseCsvLine(line);
    const prop = (f[0] || '').trim();
    if (!prop || prop === 'Property' || prop === 'Starting Balance' || prop.startsWith('->')) continue;

    const date = (f[1] || '').trim();
    const m = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) continue;
    const month = `${m[3]}-${m[1]}`;

    const credit = parseAmount(f[6]);
    if (credit <= 0) continue;

    rows.push({
      propertyRaw: prop,
      propertyShort: prop.split(' - ')[0].trim(),
      payer: (f[2] || '').trim(),
      date,
      month,
      credit,
      description: (f[8] || '').trim(),
    });
  }
  return rows;
}

/** Ciclo de fechamento 15-a-15 (rotulado pelo mês de início). Ex.: 10/07 → junho; 20/06 → junho. */
export function glCycle15(dateMMDDYYYY: string): string {
  const m = String(dateMMDDYYYY || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return '';
  let year = Number(m[3]);
  let month = Number(m[1]);
  const day = Number(m[2]);
  if (day < 15) {
    month -= 1;
    if (month < 1) { month = 12; year -= 1; }
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Linha do GL: recebido (4100 Credit), enviado ao owner (3250 Debit) ou management fee (6111 Debit). */
export interface GlEntry {
  account: string; // '4100' | '3250' | '6111'
  accountLabel: string;
  kind: 'RECEIVED' | 'SENT' | 'MGM_FEE';
  propertyRaw: string;
  propertyShort: string;
  payerPayee: string;
  date: string; // MM/DD/YYYY
  reference: string;
  amount: number; // magnitude positiva
  description: string;
}

/**
 * Extrai as linhas de RECEBIDO (conta 4100, Credit>0) e ENVIADO ao owner (conta 3250, Debit>0),
 * rastreando o cabeçalho de conta "-> XXXX - Label". Puro; não toca banco.
 */
export function parseGeneralLedgerEntries(csv: string): GlEntry[] {
  const lines = String(csv || '').split(/\r?\n/);
  const out: GlEntry[] = [];
  let curAccount = '';
  let curLabel = '';
  for (const line of lines) {
    if (!line.trim()) continue;
    const f = parseCsvLine(line);
    const c0 = (f[0] || '').trim();
    const hm = c0.match(/->\s*(\d{3,5})\s*-\s*(.+?)\s*$/);
    if (hm) { curAccount = hm[1]; curLabel = hm[2].trim(); continue; }
    if (!c0 || c0 === 'Property' || /^(Starting Balance|Total|Ending Balance)/i.test(c0)) continue;
    const date = (f[1] || '').trim();
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date)) continue;

    const debit = parseAmount(f[5]);
    const credit = parseAmount(f[6]);
    let kind: 'RECEIVED' | 'SENT' | 'MGM_FEE' | null = null;
    let amount = 0;
    if (curAccount === '4100' && credit > 0) { kind = 'RECEIVED'; amount = credit; }
    else if (curAccount === '3250' && debit > 0) { kind = 'SENT'; amount = debit; }
    else if (curAccount === '6111' && debit > 0) { kind = 'MGM_FEE'; amount = debit; }
    else continue;

    out.push({
      account: curAccount,
      accountLabel: curLabel,
      kind,
      propertyRaw: c0,
      propertyShort: c0.split(' - ')[0].trim(),
      payerPayee: (f[2] || '').trim(),
      date,
      reference: (f[4] || '').trim(),
      amount,
      description: (f[8] || '').trim(),
    });
  }
  return out;
}

/** Normaliza endereço/propriedade para casar GL com Property.address/code. */
export function normalizePropertyKey(s: string | null | undefined): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[.,#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface PropertyLite {
  id: string;
  address: string | null;
  code: string | null;
  mgmtFeePct: number;
}

/** Regra do fee: usa mgmtFeePct da propriedade; se fora de 0–30, default 8% (igual Owner Statement). */
export function effectiveMgmtFeePct(raw: number): number {
  if (!Number.isFinite(raw) || raw < 0 || raw > 30) return 8;
  return raw;
}

/** Casa uma chave de propriedade (do GL) com uma Property do banco. */
export function matchProperty(propShort: string, propRaw: string, props: PropertyLite[]): PropertyLite | null {
  const keys = [normalizePropertyKey(propShort), normalizePropertyKey(propRaw)].filter(Boolean);
  // exato / prefixo
  for (const p of props) {
    const cands = [normalizePropertyKey(p.address), normalizePropertyKey(p.code)].filter(Boolean);
    for (const k of keys) {
      for (const c of cands) {
        if (c === k || c.startsWith(k) || k.startsWith(c)) return p;
      }
    }
  }
  return null;
}
