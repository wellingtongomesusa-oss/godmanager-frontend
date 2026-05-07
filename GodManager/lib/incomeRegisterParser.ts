import Papa from 'papaparse';
import { createHash } from 'node:crypto';

export const INCOME_REGISTER_HEADER =
  'Type,Reference,Property,Unit,Payer,Received Date / Invoice Date,Cash Account / Income Account,Receipt Amount,Charge Amount,Description';

const COL_TYPE = 'Type';
const COL_REF = 'Reference';
const COL_PROP = 'Property';
const COL_UNIT = 'Unit';
const COL_PAYER = 'Payer';
const COL_DATE = 'Received Date / Invoice Date';
const COL_CASH = 'Cash Account / Income Account';
const COL_RECEIPT = 'Receipt Amount';
const COL_DESC = 'Description';

function cell(row: Record<string, string>, key: string): string {
  const v = row[key];
  if (v == null) return '';
  return String(v).trim();
}

function isTotalRow(row: Record<string, string>): boolean {
  const t = cell(row, COL_TYPE).toLowerCase();
  if (t === 'total') return true;
  const first = Object.values(row).find((v) => String(v || '').trim() !== '');
  if (first != null && String(first).trim().toLowerCase() === 'total') return true;
  return false;
}

function parseAmount(raw: string): number {
  const s = String(raw || '')
    .replace(/\$/g, '')
    .replace(/,/g, '')
    .trim();
  if (!s) return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

function parseMdY(raw: string): Date | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const month = parseInt(m[1], 10) - 1;
  const day = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  return new Date(Date.UTC(year, month, day));
}

export interface ParsedPayment {
  type: string | null;
  reference: string | null;
  propertyAddress: string;
  unit: string | null;
  payerName: string;
  paymentDate: Date;
  cashAccount: string;
  counterpartAccount: string | null;
  receiptAmount: number;
  description: string | null;
}

export function parseIncomeRegister(csv: string): {
  header: string;
  rows: ParsedPayment[];
  errors: string[];
} {
  const errors: string[] = [];
  const text = String(csv || '').replace(/^\uFEFF/, '');
  const nl = text.indexOf('\n');
  const firstLine = (nl === -1 ? text : text.slice(0, nl)).trim();
  const expected = INCOME_REGISTER_HEADER.trim();
  if (firstLine !== expected) {
    return { header: firstLine, rows: [], errors: ['Header line does not match Income Register export.'] };
  }

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => String(h || '').trim(),
  });

  for (const pe of parsed.errors || []) {
    if (pe?.message) errors.push(pe.message);
  }

  const data = (parsed.data || []).filter((row) =>
    Object.values(row || {}).some((v) => String(v || '').trim() !== ''),
  );

  const rows: ParsedPayment[] = [];
  let i = 0;
  let rowNumBase = 2;

  while (i < data.length) {
    const head = data[i];
    if (!head || isTotalRow(head)) {
      i++;
      rowNumBase++;
      continue;
    }

    const receiptRaw = cell(head, COL_RECEIPT);
    const receipt = parseAmount(receiptRaw);

    if (!receiptRaw || receipt === 0) {
      i++;
      rowNumBase++;
      continue;
    }

    if (Number.isNaN(receipt)) {
      errors.push(`Linha ${rowNumBase}: Receipt Amount inválido.`);
      i++;
      rowNumBase++;
      continue;
    }

    let counterpart: string | null = null;
    let paymentDate: Date | null = parseMdY(cell(head, COL_DATE));
    let consumed = 1;

    const next = data[i + 1];
    if (next && !isTotalRow(next)) {
      const tailCash = cell(next, COL_CASH);
      if (tailCash) counterpart = tailCash;
      const tailDate = parseMdY(cell(next, COL_DATE));
      if (tailDate) paymentDate = tailDate;
      else if (!paymentDate) paymentDate = parseMdY(cell(head, COL_DATE));
      consumed = 2;
    }

    if (!paymentDate) {
      errors.push(`Linha ${rowNumBase}: data em falta ou inválida (MM/DD/YYYY).`);
      i += consumed;
      rowNumBase += consumed;
      continue;
    }

    const payer = cell(head, COL_PAYER);
    const prop = cell(head, COL_PROP);
    const unitVal = cell(head, COL_UNIT);

    rows.push({
      type: cell(head, COL_TYPE) || null,
      reference: cell(head, COL_REF) || null,
      propertyAddress: prop,
      unit: unitVal || null,
      payerName: payer || 'Unknown',
      paymentDate,
      cashAccount: cell(head, COL_CASH) || '',
      counterpartAccount: counterpart,
      receiptAmount: receipt,
      description: cell(head, COL_DESC) || null,
    });

    i += consumed;
    rowNumBase += consumed;
  }

  return { header: firstLine, rows, errors };
}

export async function sha256Hex(input: string): Promise<string> {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}
