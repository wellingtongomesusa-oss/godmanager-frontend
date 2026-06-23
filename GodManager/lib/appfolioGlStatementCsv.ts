import crypto from 'node:crypto';

const COL = {
  PROPERTY: 0,
  DATE: 1,
  PAYEE: 2,
  TYPE: 3,
  REF: 4,
  DEBIT: 5,
  CREDIT: 6,
  BALANCE: 7,
  DESCRIPTION: 8,
} as const;

export type AppfolioGlPreviewRow = {
  propertyKey: string;
  yearMonth: string;
  lineType: 'income' | 'expense';
  account: string;
  amount: number;
  date: string;
  description: string;
};

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line.charAt(i);
    if (inQuotes) {
      if (c === '"') {
        if (line.charAt(i + 1) === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  fields.push(cur);
  return fields;
}

function headerTokens(headerLine: string): string[] {
  return parseCsvLine(headerLine).map((h) =>
    h
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^\w_]/g, ''),
  );
}

/** True se headers AppFolio GL (Property, Date, Debit, Credit); false se GodManager (property_code). */
export function isAppfolioGlFormat(headerLine: string): boolean {
  const tokens = headerTokens(headerLine);
  if (tokens.includes('property_code')) return false;
  const set = new Set(tokens);
  return set.has('property') && set.has('date') && set.has('debit') && set.has('credit');
}

function parseMoney(raw: string | undefined): number {
  const s = String(raw ?? '').trim();
  if (!s) return 0;
  const n = parseFloat(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function parseYearMonth(dateStr: string | undefined): string | null {
  const s = String(dateStr ?? '').trim();
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const month = m[1].padStart(2, '0');
  return `${m[3]}-${month}`;
}

function parseAccountHeader(propertyField: string): number | null {
  const s = String(propertyField ?? '').trim();
  const m = /^->\s*(\d+)\s*-/i.exec(s);
  if (!m) return null;
  return parseInt(m[1], 10);
}

function classifyAccount(accountNum: number): 'income' | 'expense' | 'ignore' | 'other' {
  if (accountNum >= 4000 && accountNum <= 4999) return 'income';
  if (accountNum >= 6000 && accountNum <= 7999) return 'expense';
  if (accountNum >= 1000 && accountNum <= 3999) return 'ignore';
  return 'other';
}

/**
 * Parser General Ledger AppFolio — mesma lógica validada em scripts/parse-appfolio-ledger.mjs.
 */
export function parseAppfolioGl(content: string): {
  rows: AppfolioGlPreviewRow[];
  ignoredCount: number;
  errors: string[];
} {
  const lines = content.split(/\r?\n/);
  const rows: AppfolioGlPreviewRow[] = [];
  const errors: string[] = [];
  let ignoredCount = 0;
  let currentAccount: number | null = null;
  let currentAccountLabel = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const fields = parseCsvLine(line);
    if (i === 0 && fields[COL.PROPERTY].toLowerCase() === 'property') continue;

    const propertyRaw = fields[COL.PROPERTY] ?? '';
    const propertyTrim = propertyRaw.trim();

    if (propertyTrim.startsWith('->')) {
      currentAccount = parseAccountHeader(propertyTrim);
      currentAccountLabel = propertyTrim.replace(/^->\s*/, '').trim();
      continue;
    }

    if (!currentAccount) continue;
    if (propertyTrim === 'Starting Balance' || !propertyTrim) continue;

    const yearMonth = parseYearMonth(fields[COL.DATE]);
    if (!yearMonth) continue;

    const kind = classifyAccount(currentAccount);
    const debit = parseMoney(fields[COL.DEBIT]);
    const credit = parseMoney(fields[COL.CREDIT]);
    const description = String(fields[COL.DESCRIPTION] ?? '').trim();
    const date = String(fields[COL.DATE] ?? '').trim();

    if (kind === 'ignore') {
      ignoredCount += 1;
      continue;
    }
    if (kind === 'other') continue;

    if (kind === 'income') {
      if (credit === 0) continue;
      rows.push({
        propertyKey: propertyTrim,
        yearMonth,
        lineType: 'income',
        account: currentAccountLabel || String(currentAccount),
        amount: credit,
        date,
        description,
      });
    } else if (kind === 'expense') {
      if (debit === 0) continue;
      rows.push({
        propertyKey: propertyTrim,
        yearMonth,
        lineType: 'expense',
        account: currentAccountLabel || String(currentAccount),
        amount: debit,
        date,
        description,
      });
    }
  }

  return { rows, ignoredCount, errors };
}

/** MM/DD/YYYY → Date UTC meio-dia (igual ownerStatementCsv). */
export function parseAppfolioSlashDate(dateStr: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(dateStr ?? '').trim());
  if (!m) return null;
  const mo = parseInt(m[1], 10);
  const d = parseInt(m[2], 10);
  const y = parseInt(m[3], 10);
  if (!Number.isFinite(mo) || !Number.isFinite(d) || !Number.isFinite(y)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== mo || dt.getUTCDate() !== d) return null;
  return dt;
}

/** Hash idempotente para CSV_UPLOAD AppFolio GL (propertyId|yearMonth|account|date|amount|description). */
export function appfolioGlRowSourceRef(args: {
  propertyId: string;
  yearMonth: string;
  account: string;
  date: string;
  amount: number;
  description: string;
}): string {
  const amountFixed = args.amount.toFixed(2);
  const desc =
    args.description.length > 300 ? args.description.slice(0, 300) : args.description;
  const base = `${args.propertyId}|${args.yearMonth}|${args.account}|${args.date}|${amountFixed}|${desc}`;
  return crypto.createHash('sha256').update(base).digest('hex').slice(0, 32);
}
