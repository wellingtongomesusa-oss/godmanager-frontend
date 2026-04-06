/**
 * Ranking DP por unidade — DP por reserva = (Bedrooms×10+9) × Nights; agregar por unidade.
 */
import { csvCell } from '@/lib/manager-pro/csvCell';
import { dpValue } from '@/lib/manager-pro/dpMerge';
import {
  normalizeUnitKey,
  parsePropertiesExcelHeaderAt,
  parsePropertiesExcelHeader1,
  parsePropertiesExcelPivotHeader2,
  type PropertyUnitRow,
} from '@/lib/manager-pro/propertiesMerge';

export type ReservationNightRow = { unit: string; nights: number };

export type DpRankingRow = {
  rank: number;
  unitName: string;
  bedrooms: number;
  resCount: number;
  nightsTotal: number;
  dpTotal: number;
};

/** Cabeçalho linha 1 → pivot (linha 3) → cabeçalho na 2.ª linha (índice 1). */
export function parseUnitsExcelForDpRanking(rows: unknown[][]): PropertyUnitRow[] {
  const h0 = parsePropertiesExcelHeader1(rows);
  if (h0.length > 0) return h0;
  const pivot = parsePropertiesExcelPivotHeader2(rows);
  if (pivot.length > 0) return pivot;
  return parsePropertiesExcelHeaderAt(rows, 1);
}

export function parseReservationsCsvForDpRanking(rows: Record<string, string>[]): ReservationNightRow[] {
  const out: ReservationNightRow[] = [];
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const unit = csvCell(r, 'Unit', 'unit');
    if (!unit) continue;
    const nightsStr = csvCell(r, 'Nights', 'nights');
    const nights = Math.max(0, parseFloat(String(nightsStr).replace(/,/g, '.')) || 0);
    out.push({ unit, nights });
  }
  return out;
}

export function computeDpRanking(
  units: PropertyUnitRow[],
  reservations: ReservationNightRow[]
): { rows: DpRankingRow[]; unmatchedReservations: number } {
  const unitMap = new Map<string, { unitName: string; bedrooms: number }>();
  for (const u of units) {
    const k = normalizeUnitKey(u.unitName);
    if (!unitMap.has(k)) unitMap.set(k, { unitName: u.unitName, bedrooms: u.bedrooms });
  }

  const agg = new Map<
    string,
    { unitName: string; bedrooms: number; resCount: number; nightsTotal: number; dpTotal: number }
  >();

  let unmatchedReservations = 0;
  for (const res of reservations) {
    const k = normalizeUnitKey(res.unit);
    const ub = unitMap.get(k);
    if (!ub) {
      unmatchedReservations += 1;
      continue;
    }
    const dpRes = dpValue(ub.bedrooms) * res.nights;
    const cur = agg.get(k) ?? {
      unitName: ub.unitName,
      bedrooms: ub.bedrooms,
      resCount: 0,
      nightsTotal: 0,
      dpTotal: 0,
    };
    cur.resCount += 1;
    cur.nightsTotal += res.nights;
    cur.dpTotal += dpRes;
    agg.set(k, cur);
  }

  const sorted = [...agg.values()].sort((a, b) => b.dpTotal - a.dpTotal);
  const rows: DpRankingRow[] = sorted.map((r, i) => ({
    rank: i + 1,
    unitName: r.unitName,
    bedrooms: r.bedrooms,
    resCount: r.resCount,
    nightsTotal: r.nightsTotal,
    dpTotal: r.dpTotal,
  }));

  return { rows, unmatchedReservations };
}
