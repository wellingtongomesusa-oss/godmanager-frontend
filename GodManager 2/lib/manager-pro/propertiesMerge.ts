/**
 * Properties — Excel + DataGrid CSV, merge Unit Name = Unit
 * Formatos Excel:
 * - Header linha 1 (índice 0): Unit Name, Bedrooms, Community, Franchisee
 * - Export pivot (ex. export__88_.xlsx): linhas 0–1 vazias; linha 2 = cabeçalho
 *   (pandas header=2) → «Row Labels» | «Sum of Bedrooms»; dados a partir da linha 3;
 *   ignorar «Grand Total».
 * DP = Bedrooms×10+9 (ex.: 5Q → 5 → DP 59)
 * DP Volume = DP × nº reservas da unidade
 */
import { csvCell, csvMoney } from '@/lib/manager-pro/csvCell';
import { dpValue } from '@/lib/manager-pro/dpMerge';

export type PropertyUnitRow = {
  unitName: string;
  bedrooms: number;
  community: string;
  franchisee: string;
};

export type ReservationAgg = {
  total: { count: number; revenue: number };
  byMonth: Map<string, { count: number; revenue: number }>;
};

function normHeader(h: unknown): string {
  return String(h ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function colIndex(headers: string[], aliases: string[]): number {
  const n = headers.map(normHeader);
  for (const a of aliases) {
    const na = normHeader(a);
    const i = n.findIndex((h) => h === na);
    if (i >= 0) return i;
  }
  return -1;
}

/** Excel: cabeçalho na linha `headerRowIdx` (0 = primeira linha; 1 = «2.ª linha»). */
export function parsePropertiesExcelHeaderAt(rows: unknown[][], headerRowIdx: number): PropertyUnitRow[] {
  if (rows.length <= headerRowIdx + 1) return [];
  const headerRow = rows[headerRowIdx] as unknown[];
  if (!headerRow?.length) return [];
  const headers = headerRow.map((c) => String(c ?? ''));
  const iu = colIndex(headers, ['unit name', 'unit']);
  const ib = colIndex(headers, ['bedrooms', 'bedroom', 'quartos', '# bedrooms']);
  const ic = colIndex(headers, ['community', 'condominium', 'condomínio', 'neighborhood']);
  const ifr = colIndex(headers, ['franchisee', 'franchise', 'franqueado']);
  if (iu < 0 || ib < 0) return [];

  const out: PropertyUnitRow[] = [];
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    if (!row?.length) continue;
    const unitName = String(row[iu] ?? '').trim();
    if (!unitName) continue;
    if (/^grand\s*total$/i.test(unitName.trim())) continue;
    const bedrooms = parseBedroomsCell(row[ib]);
    const community = ic >= 0 ? String(row[ic] ?? '').trim() : '';
    const franchisee = ifr >= 0 ? String(row[ifr] ?? '').trim() : '';
    out.push({ unitName, bedrooms, community, franchisee });
  }
  return out;
}

/** Excel: primeira linha = cabeçalho (header=1 → índice 0) */
export function parsePropertiesExcelHeader1(rows: unknown[][]): PropertyUnitRow[] {
  return parsePropertiesExcelHeaderAt(rows, 0);
}

/**
 * Pivot / export com 2 colunas: cabeçalho real na linha de índice 2 (pandas header=2).
 * Equiv. pandas: read_excel(..., header=2); filtrar Grand Total; dropna Unit Name;
 * Bedrooms fillna(0).astype(int)
 */
export function parsePropertiesExcelPivotHeader2(rows: unknown[][]): PropertyUnitRow[] {
  if (rows.length < 4) return [];
  const headerRow = rows[2] as unknown[];
  if (!headerRow?.length) return [];
  const headers = headerRow.map((c) => String(c ?? ''));
  const iu = colIndex(headers, [
    'row labels',
    'unit name',
    'unit',
    'property',
    'listing',
  ]);
  const ib = colIndex(headers, [
    'sum of bedrooms',
    'bedrooms',
    'bedroom',
    'quartos',
    '# bedrooms',
  ]);
  if (iu < 0 || ib < 0) return [];

  const out: PropertyUnitRow[] = [];
  for (let r = 3; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    if (!row?.length) continue;
    const rawUnit = row[iu];
    if (rawUnit === undefined || rawUnit === null) continue;
    const unitName = String(rawUnit).trim();
    if (!unitName) continue;
    if (/^grand\s*total$/i.test(unitName.trim())) continue;
    const bedrooms = parseBedroomsCell(row[ib]);
    out.push({ unitName, bedrooms, community: '', franchisee: '' });
  }
  return out;
}

/** Tenta header linha 1; se vazio, tenta pivot header=2 (Row Labels + Sum of Bedrooms). */
export function parsePropertiesExcelAuto(rows: unknown[][]): PropertyUnitRow[] {
  const fromHeader1 = parsePropertiesExcelHeader1(rows);
  if (fromHeader1.length > 0) return fromHeader1;
  return parsePropertiesExcelPivotHeader2(rows);
}

export function parseBedroomsCell(v: unknown): number {
  const s = String(v ?? '').trim();
  const m = s.match(/^(\d+)/);
  if (m) return Math.max(0, parseInt(m[1], 10));
  const n = Number(s.replace(',', '.'));
  if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  return 0;
}

export function normalizeUnitKey(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

/** Mesmas exclusões do DataGrid de reservas (opcional) */
export function excludeDataGridSource(raw: string): boolean {
  const s = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return false;
  if (s.includes('blacked out')) return true;
  if (s.includes('ogr/te')) return true;
  if (s === 'own') return true;
  if (s === 'mnt') return true;
  return false;
}

function monthKeyFromRow(r: Record<string, string>): string {
  const dStr = csvCell(
    r,
    'Arrival Date',
    'Arrival date',
    'Arrival',
    'Check-in',
    'Check In',
    'Start Date',
    'ArrivalDate'
  );
  const d = new Date(dStr);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Agrega reservas por unidade (total + por mês) */
export function aggregateReservationsByUnit(
  csvRows: Record<string, string>[],
  opts: { excludeSources: boolean }
): Map<string, ReservationAgg> {
  const map = new Map<string, ReservationAgg>();

  const bump = (unitKey: string, month: string, revenue: number) => {
    let agg = map.get(unitKey);
    if (!agg) {
      agg = { total: { count: 0, revenue: 0 }, byMonth: new Map() };
      map.set(unitKey, agg);
    }
    agg.total.count += 1;
    agg.total.revenue += revenue;
    if (month) {
      const m = agg.byMonth.get(month) ?? { count: 0, revenue: 0 };
      m.count += 1;
      m.revenue += revenue;
      agg.byMonth.set(month, m);
    }
  };

  for (const r of csvRows) {
    const src = csvCell(r, 'Source', 'source', 'Agency', 'Channel');
    if (opts.excludeSources && excludeDataGridSource(src)) continue;
    const unit = normalizeUnitKey(csvCell(r, 'Unit', 'unit', 'Unit Name', 'Property', 'Listing'));
    if (!unit) continue;
    const revenue = csvMoney(csvCell(r, 'Revenue', 'revenue', 'Total', 'Amount', 'Gross', 'Booking total'));
    const month = monthKeyFromRow(r);
    bump(unit, month, revenue);
  }
  return map;
}

export type MergedPropertyRow = {
  unitName: string;
  bedrooms: number;
  dp: number;
  community: string;
  franchisee: string;
  resCount: number;
  revenue: number;
  dpVolume: number;
};

/** Contagem de unidades no catálogo (Excel) por nº de quartos — respeita o merge já filtrado por mês nas métricas da linha, mas cada unidade aparece uma vez */
export function countUnitsByBedroom(merged: MergedPropertyRow[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const r of merged) {
    const b = r.bedrooms;
    m.set(b, (m.get(b) ?? 0) + 1);
  }
  return m;
}

export function mergePropertiesWithReservations(
  units: PropertyUnitRow[],
  resByUnit: Map<string, ReservationAgg>,
  monthFilter: string | null
): MergedPropertyRow[] {
  const rows: MergedPropertyRow[] = [];
  for (const u of units) {
    const key = normalizeUnitKey(u.unitName);
    const agg = resByUnit.get(key);
    let resCount = 0;
    let revenue = 0;
    if (agg) {
      if (monthFilter) {
        const m = agg.byMonth.get(monthFilter);
        resCount = m?.count ?? 0;
        revenue = m?.revenue ?? 0;
      } else {
        resCount = agg.total.count;
        revenue = agg.total.revenue;
      }
    }
    const dp = dpValue(u.bedrooms);
    rows.push({
      unitName: u.unitName,
      bedrooms: u.bedrooms,
      dp,
      community: u.community || '—',
      franchisee: u.franchisee || '—',
      resCount,
      revenue,
      dpVolume: dp * resCount,
    });
  }
  return rows;
}

export type BedroomBucket = '1–3' | '4' | '5' | '6+';

export function bedroomBucket(b: number): BedroomBucket {
  if (b <= 3) return '1–3';
  if (b === 4) return '4';
  if (b === 5) return '5';
  return '6+';
}

/** Small 1–3 · Med 4–5 · Large 6–7 · XL 8+ */
export type SizeBreakdown = { small: number; med: number; large: number; xl: number };

export function bedroomSizeSlot(b: number): keyof SizeBreakdown {
  if (b <= 3) return 'small';
  if (b <= 5) return 'med';
  if (b <= 7) return 'large';
  return 'xl';
}

export type CommunityRollup = {
  community: string;
  revenue: number;
  unitCount: number;
  resCount: number;
  dpVolume: number;
  /** Σ DP por unidade (inventário) */
  dpInventoryTotal: number;
  ticket: number;
  sizes: SizeBreakdown;
  byBucket: Record<BedroomBucket, { units: number; revenue: number }>;
};

export function rollupByCommunity(merged: MergedPropertyRow[]): CommunityRollup[] {
  const map = new Map<string, CommunityRollup>();
  for (const r of merged) {
    const c = r.community || '—';
    if (!map.has(c)) {
      map.set(c, {
        community: c,
        revenue: 0,
        unitCount: 0,
        resCount: 0,
        dpVolume: 0,
        dpInventoryTotal: 0,
        ticket: 0,
        sizes: { small: 0, med: 0, large: 0, xl: 0 },
        byBucket: {
          '1–3': { units: 0, revenue: 0 },
          '4': { units: 0, revenue: 0 },
          '5': { units: 0, revenue: 0 },
          '6+': { units: 0, revenue: 0 },
        },
      });
    }
    const x = map.get(c)!;
    x.revenue += r.revenue;
    x.unitCount += 1;
    x.resCount += r.resCount;
    x.dpVolume += r.dpVolume;
    x.dpInventoryTotal += r.dp;
    x.sizes[bedroomSizeSlot(r.bedrooms)] += 1;
    const bk = bedroomBucket(r.bedrooms);
    x.byBucket[bk].units += 1;
    x.byBucket[bk].revenue += r.revenue;
  }
  for (const x of map.values()) {
    x.ticket = x.resCount > 0 ? x.revenue / x.resCount : 0;
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

export type FranchiseeRollup = {
  franchisee: string;
  unitCount: number;
  revenue: number;
  resCount: number;
  avgRevenuePerUnit: number;
  avgResPerUnit: number;
};

export function rollupByFranchisee(merged: MergedPropertyRow[]): FranchiseeRollup[] {
  const map = new Map<string, FranchiseeRollup>();
  for (const r of merged) {
    const f = r.franchisee || '—';
    if (!map.has(f)) {
      map.set(f, { franchisee: f, unitCount: 0, revenue: 0, resCount: 0, avgRevenuePerUnit: 0, avgResPerUnit: 0 });
    }
    const x = map.get(f)!;
    x.unitCount += 1;
    x.revenue += r.revenue;
    x.resCount += r.resCount;
  }
  for (const x of map.values()) {
    x.avgRevenuePerUnit = x.unitCount ? x.revenue / x.unitCount : 0;
    x.avgResPerUnit = x.unitCount ? x.resCount / x.unitCount : 0;
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

/** Demo alinhado ao PDF */
export const DEMO_TOP_COMMUNITY = { name: 'Storey Lake', revenue: 1412941, units: 168 };
export const DEMO_TOP_FRANCHISEE = { name: 'Beatriz Vicente', revenue: 555511, units: 41 };

/** Ref. portfólio (sem ficheiros) */
export const DEMO_PORTFOLIO = {
  dpTotal: 64433,
  dpVolume: 342743,
  revenue: 8896844,
  totalUnits: 977,
  activeUnits: 907,
};

/** Ref. DP por tipo de quartos (2Q → $29 …) */
export const REF_DP_QUARTOS: { label: string; bedrooms: number; dp: number }[] = [
  { label: '2Q', bedrooms: 2, dp: 29 },
  { label: '3Q', bedrooms: 3, dp: 39 },
  { label: '5Q', bedrooms: 5, dp: 59 },
  { label: '7Q', bedrooms: 7, dp: 79 },
  { label: '10Q', bedrooms: 10, dp: 109 },
  { label: '15Q', bedrooms: 15, dp: 159 },
];

export function portfolioTotals(merged: MergedPropertyRow[]): {
  dpTotal: number;
  dpVolume: number;
  revenue: number;
} {
  let dpTotal = 0;
  let dpVolume = 0;
  let revenue = 0;
  for (const r of merged) {
    dpTotal += r.dp;
    dpVolume += r.dpVolume;
    revenue += r.revenue;
  }
  return { dpTotal, dpVolume, revenue };
}

/** Série mensal (todas as chaves) para gráfico / accordion */
export function unitMonthlySeries(
  unitName: string,
  resByUnit: Map<string, ReservationAgg>
): { month: string; count: number; revenue: number }[] {
  const agg = resByUnit.get(normalizeUnitKey(unitName));
  if (!agg) return [];
  return [...agg.byMonth.entries()]
    .map(([month, v]) => ({ month, count: v.count, revenue: v.revenue }))
    .sort((a, b) => a.month.localeCompare(b.month));
}
