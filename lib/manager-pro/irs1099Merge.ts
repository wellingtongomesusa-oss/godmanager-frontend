/**
 * AllBillsPage CSV — 1099 eligible vs Hospitality (owners)
 * localStorage: 1099_data_YYYY_MM → substitui mês ao re-upload
 */
import { csvCell, csvMoney } from '@/lib/manager-pro/csvCell';

export const STORAGE_PREFIX = '1099_data_';

export const COA_1099_ELIGIBLE = '50060 - INDIVIDUALS 1099 ELIGIBLE';
export const COA_HOSPITALITY = '50220 - VACATION HOME OWNER RENT PAYOUT';

export const IRS_1099_THRESHOLD = 600;

export type SegmentKey = 'CONTRACTORS' | 'CLEANERS' | 'RENT' | 'VENDORS+OUTROS';

export type StoredMonthPayload = {
  rows: Record<string, string>[];
  uploadedAt: string;
  fileName?: string;
};

export function storageKey(year: number, month: number): string {
  return `${STORAGE_PREFIX}${year}_${String(month).padStart(2, '0')}`;
}

export function parseStorageKey(key: string): { year: number; month: number } | null {
  const m = key.match(/^1099_data_(\d{4})_(\d{2})$/);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) };
}

export function rowChartOfAccount(r: Record<string, string>): string {
  return csvCell(
    r,
    'Chart of Account',
    'Chart of Accounts',
    'Chart Of Account',
    'Account',
    'COA',
    'Category'
  );
}

export function rowVendor(r: Record<string, string>): string {
  return csvCell(r, 'Vendor', 'Vendor Name', 'Payee', 'Payee Name', 'Name');
}

export function rowAmount(r: Record<string, string>): number {
  return csvMoney(csvCell(r, 'Amount', 'Total', 'Debit', 'Payment', 'Paid', 'Expense'));
}

export function rowClass(r: Record<string, string>): string {
  return csvCell(r, 'Class', 'Classes', 'Department', 'Location');
}

export function rowDate(r: Record<string, string>): Date | null {
  const dStr = csvCell(r, 'Date', 'Transaction Date', 'Posting Date', 'Bill Date', 'Paid Date');
  const d = new Date(dStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function matchesCoa(cell: string, expectedFull: string): boolean {
  const t = cell.trim();
  const e = expectedFull.trim();
  return t === e || t.includes(e) || e.includes(t);
}

export function filter1099Eligible(rows: Record<string, string>[]): Record<string, string>[] {
  return rows.filter((r) => matchesCoa(rowChartOfAccount(r), COA_1099_ELIGIBLE));
}

export function filterHospitality(rows: Record<string, string>[]): Record<string, string>[] {
  return rows.filter((r) => matchesCoa(rowChartOfAccount(r), COA_HOSPITALITY));
}

/** Segmentação heurística (Class / memo); ajuste se o AllBills export mudar */
export function segment1099(classStr: string, memo?: string): SegmentKey {
  const c = classStr.toUpperCase().trim();
  const blob = `${classStr} ${memo ?? ''}`.toUpperCase();
  if (blob.includes('CLEANER')) return 'CLEANERS';
  if (/\bRENT\b/.test(c) || c === 'RENT') return 'RENT';
  if (blob.includes('VENDOR') || blob.includes('SUPPLIES') || blob.includes('MISC') || blob.includes('OTHER'))
    return 'VENDORS+OUTROS';
  return 'CONTRACTORS';
}

export type SegmentAgg = {
  segment: SegmentKey;
  total: number;
  vendorCount: number;
  classCount: number;
  /** vendors → total (para export IRS) */
  vendorTotals: Map<string, number>;
};

export function aggregate1099BySegment(rows: Record<string, string>[]): Map<SegmentKey, SegmentAgg> {
  const segs: SegmentKey[] = ['CONTRACTORS', 'CLEANERS', 'RENT', 'VENDORS+OUTROS'];
  const init = (): SegmentAgg => ({
    segment: 'CONTRACTORS',
    total: 0,
    vendorCount: 0,
    classCount: 0,
    vendorTotals: new Map(),
  });
  const map = new Map<SegmentKey, SegmentAgg>();
  for (const s of segs) {
    map.set(s, { ...init(), segment: s });
  }
  const classesBySeg = new Map<SegmentKey, Set<string>>();
  for (const s of segs) classesBySeg.set(s, new Set());

  for (const r of rows) {
    const memo = csvCell(r, 'Memo', 'memo', 'Description', 'Notes');
    const seg = segment1099(rowClass(r), memo);
    const a = map.get(seg)!;
    const amt = rowAmount(r);
    a.total += amt;
    const v = rowVendor(r) || '—';
    a.vendorTotals.set(v, (a.vendorTotals.get(v) ?? 0) + amt);
    const cl = rowClass(r).trim() || '—';
    classesBySeg.get(seg)!.add(cl);
  }

  for (const s of segs) {
    const a = map.get(s)!;
    a.vendorCount = [...a.vendorTotals.keys()].filter((k) => k && k !== '—').length;
    a.classCount = classesBySeg.get(s)!.size;
  }
  return map;
}

export type HospitalityMonth = { key: string; year: number; month: number; total: number };

export function aggregateHospitalityByStorageMonth(
  loadRows: (storageKey: string) => Record<string, string>[]
): HospitalityMonth[] {
  if (typeof window === 'undefined') return [];
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(STORAGE_PREFIX)) keys.push(k);
  }
  keys.sort();
  const out: HospitalityMonth[] = [];
  for (const key of keys) {
    const parsed = parseStorageKey(key);
    if (!parsed) continue;
    const rows = loadRows(key);
    const hosp = filterHospitality(rows);
    const total = hosp.reduce((s, r) => s + rowAmount(r), 0);
    out.push({ key, year: parsed.year, month: parsed.month, total });
  }
  return out;
}

export type QualifiedVendor = { vendor: string; total: number; segment: SegmentKey };

/** Vendors com total ≥ $600 (1099 eligible, todos os meses); segmento = maior volume por vendor */
export function qualified1099Vendors(rows1099: Record<string, string>[]): QualifiedVendor[] {
  const totals = new Map<string, number>();
  for (const r of rows1099) {
    const v = rowVendor(r) || '—';
    if (!v || v === '—') continue;
    totals.set(v, (totals.get(v) ?? 0) + rowAmount(r));
  }
  const memo = (r: Record<string, string>) => csvCell(r, 'Memo', 'memo', 'Description', 'Notes');
  const out: QualifiedVendor[] = [];
  for (const [vendor, total] of totals) {
    if (total < IRS_1099_THRESHOLD) continue;
    const bySeg = new Map<SegmentKey, number>();
    for (const r of rows1099) {
      if ((rowVendor(r) || '—') !== vendor) continue;
      const s = segment1099(rowClass(r), memo(r));
      bySeg.set(s, (bySeg.get(s) ?? 0) + rowAmount(r));
    }
    let best: SegmentKey = 'CONTRACTORS';
    let max = 0;
    for (const [s, t] of bySeg) {
      if (t > max) {
        max = t;
        best = s;
      }
    }
    out.push({ vendor, total, segment: best });
  }
  return out.sort((a, b) => b.total - a.total);
}

export function toQualifiedCsv(qualified: QualifiedVendor[]): string {
  const header = 'Vendor,Total USD,Segment,IRS_1099_Eligible';
  const lines = qualified.map(
    (q) => `"${q.vendor.replace(/"/g, '""')}",${q.total.toFixed(2)},${q.segment},YES`
  );
  return [header, ...lines].join('\n');
}

/** Demo segmentos (PDF ref.) */
export const DEMO_SEGMENTS: Record<
  SegmentKey,
  { total: number; vendors: number; classes: string }
> = {
  CONTRACTORS: { total: 2011432, vendors: 42, classes: '866 classes' },
  CLEANERS: { total: 1568935, vendors: 96, classes: 'CLEANER' },
  RENT: { total: 10053, vendors: 1, classes: 'RENT' },
  'VENDORS+OUTROS': { total: 428695, vendors: 39, classes: '—' },
};

/** Repasses owners (ref. PDF) — total global; meses detalhados */
export const DEMO_HOSPITALITY = {
  totalRef: 9162634,
  months: [
    { label: 'Jan/2026', total: 3992845 },
    { label: 'Fev/2026', total: 2406499 },
    { label: 'Mar/2026', total: 2763289 },
  ],
};
