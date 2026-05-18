import Papa from 'papaparse';
import crypto from 'node:crypto';

export type CsvLineParseResult =
  | {
      ok: true;
      line: number;
      row: {
        propertyCode: string;
        date: Date;
        type: 'income' | 'expense';
        description: string;
        amount: number;
      };
    }
  | { ok: false; line: number; errors: string[] };

const REQUIRED = ['property_code', 'date', 'type', 'description', 'amount'] as const;
const DESC_MAX = 300;

const PROPERTY_CODE_RE = /^P\d{4}$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SLASH_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function normalizeHeaderKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = k.trim().toLowerCase().replace(/\s+/g, '_');
    out[key] = v;
  }
  return out;
}

/** Data em UTC ao meio-dia (evita artefactos ao derivar YYYY-MM). */
function utcYmd(year: number, month1: number, day: number): Date {
  return new Date(Date.UTC(year, month1 - 1, day, 12, 0, 0));
}

/** YYYY-MM-DD -> Date UTC ao meio-dia do dia indicado */
function parseIsoDate(s: string): Date | null {
  const m = ISO_DATE.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = utcYmd(y, mo, d);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== mo || dt.getUTCDate() !== d) return null;
  return dt;
}

/** DD/MM ou MM/DD: se ambíguo ambos<=12 falha pedindo ISO. */
function parseSlashDate(raw: string): Date | null {
  const m = SLASH_DATE.exec(raw.trim());
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const y = Number(m[3]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(y)) return null;
  if (a < 1 || b < 1 || a > 31 || b > 31 || y < 1000 || y > 9999) return null;

  if (a <= 12 && b <= 12) {
    return null;
  }
  if (a > 12 && b > 12) {
    return null;
  }

  let mo: number;
  let d: number;
  if (a > 12) {
    d = a;
    mo = b;
  } else {
    mo = a;
    d = b;
  }

  if (mo < 1 || mo > 12) return null;
  const dt = utcYmd(y, mo, d);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== mo || dt.getUTCDate() !== d) return null;
  return dt;
}

function parseCsvDate(value: unknown, errors: string[]): Date | undefined {
  if (typeof value !== 'string' || !value.trim()) {
    errors.push('invalid_date');
    return undefined;
  }
  const s = value.trim();
  const iso = parseIsoDate(s);
  if (iso) return iso;

  const slash = parseSlashDate(s);
  if (slash) return slash;

  if (SLASH_DATE.test(s)) {
    errors.push('ambiguous_slash_date_use_iso_yyyy_mm_dd');
  } else {
    errors.push('invalid_date_use_iso_yyyy_mm_dd_or_unambiguous_dd_mm_slash_mm_dd_slash');
  }
  return undefined;
}

function parseAmount(value: unknown, errors: string[]): number | undefined {
  const raw =
    typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    errors.push('invalid_amount');
    return undefined;
  }
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) {
    errors.push('amount_must_be_positive');
    return undefined;
  }
  const rounded = Math.round(n * 100) / 100;
  if (rounded <= 0) {
    errors.push('amount_must_be_positive');
    return undefined;
  }
  return rounded;
}

function truncateDescription(raw: unknown, errors: string[]): string | undefined {
  if (typeof raw !== 'string' || !raw.trim()) {
    errors.push('invalid_description');
    return undefined;
  }
  const t = raw.trim();
  return t.length > DESC_MAX ? t.slice(0, DESC_MAX) : t;
}

function parseLineType(raw: unknown, errors: string[]): 'income' | 'expense' | undefined {
  if (typeof raw !== 'string' || !raw.trim()) {
    errors.push('invalid_type');
    return undefined;
  }
  const x = raw.trim().toLowerCase();
  if (x !== 'income' && x !== 'expense') {
    errors.push('type_must_be_income_or_expense');
    return undefined;
  }
  return x as 'income' | 'expense';
}

function parsePropertyCode(raw: unknown, errors: string[]): string | undefined {
  if (typeof raw !== 'string' || !raw.trim()) {
    errors.push('invalid_property_code');
    return undefined;
  }
  const c = raw.trim().toUpperCase();
  if (!PROPERTY_CODE_RE.test(c)) {
    errors.push('invalid_property_code');
    return undefined;
  }
  return c;
}

export function parseStatementCsv(content: string): {
  header: { ok: boolean; missingColumns: string[] };
  rows: CsvLineParseResult[];
} {
  const parsed = Papa.parse<Record<string, unknown>>(content, {
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
  });

  const missingColumns: string[] = [];
  if (!parsed.meta.fields?.length) {
    return {
      header: { ok: false, missingColumns: [...REQUIRED] },
      rows: [],
    };
  }

  const fieldSet = new Set(parsed.meta.fields.map((f) => f.trim().toLowerCase().replace(/\s+/g, '_')));
  for (const col of REQUIRED) {
    if (!fieldSet.has(col)) missingColumns.push(col);
  }

  if (missingColumns.length > 0) {
    return { header: { ok: false, missingColumns }, rows: [] };
  }

  const rows: CsvLineParseResult[] = [];
  const dataRows = parsed.data.filter((r) =>
    Object.values(normalizeHeaderKeys(r)).some((v) => v != null && String(v).trim() !== '')
  );

  let index = 0;
  for (const rawRow of dataRows) {
    index++;
    const line = index + 1;
    const row = normalizeHeaderKeys(rawRow);
    const errs: string[] = [];

    const propertyCode = parsePropertyCode(row.property_code, errs);
    const date = parseCsvDate(row.date, errs);
    const type = parseLineType(row.type, errs);
    const description = truncateDescription(row.description, errs);
    const amount = parseAmount(row.amount, errs);

    if (errs.length > 0) {
      rows.push({ ok: false, line, errors: errs });
      continue;
    }

    if (!propertyCode || !date || !type || !description || amount == null) {
      rows.push({ ok: false, line, errors: ['invalid_row'] });
      continue;
    }

    rows.push({
      ok: true,
      line,
      row: { propertyCode, date, type, description, amount },
    });
  }

  return { header: { ok: true, missingColumns: [] }, rows };
}

/** Hash de 32 chars para sourceRefId em linhas CSV_UPLOAD (idempotência). */
export function statementCsvRowSourceRef(args: {
  propertyCode: string;
  dateISO: string;
  type: 'income' | 'expense';
  descriptionTrunc: string;
  amountFixed: string;
}): string {
  const base = `${args.propertyCode}|${args.dateISO}|${args.type}|${args.descriptionTrunc}|${args.amountFixed}`;
  return crypto.createHash('sha256').update(base).digest('hex').slice(0, 32);
}
