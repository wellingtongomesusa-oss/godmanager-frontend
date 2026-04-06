/**
 * Módulo 15–16 — DP = Bedrooms×10+9, merge CSV + Excel
 */
export function dpValue(bedrooms: number): number {
  return bedrooms * 10 + 9;
}

export type UnitRow = { unitName: string; bedrooms: number };

/** Parse Excel export (header na linha 3 → índice 2) via sheet rows from xlsx */
export function parseUnitExcelRows(rows: unknown[][]): UnitRow[] {
  const headerIdx = 2;
  const out: UnitRow[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as (string | number | undefined)[];
    if (!row?.length) continue;
    const name = String(row[0] ?? '').trim();
    if (!name || name === 'Grand Total') continue;
    const bed = Number(row[1] ?? 0) || 0;
    out.push({ unitName: name, bedrooms: Math.floor(bed) });
  }
  return out;
}

export type ReservationRow = { unit: string; revenue: number; month?: string };

export function mergeDpWithReservations(
  units: UnitRow[],
  reservations: ReservationRow[]
): {
  rows: {
    unit: string;
    bedrooms: number;
    dp: number;
    resCount: number;
    dpVolume: number;
    revenue: number;
  }[];
  withRes: number;
  withoutRes: number;
  dpTotal: number;
  dpVolumeTotal: number;
  revenueTotal: number;
} {
  const byUnit = new Map<string, { count: number; revenue: number }>();
  for (const r of reservations) {
    const u = r.unit.trim();
    if (!u) continue;
    const cur = byUnit.get(u) ?? { count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue += r.revenue;
    byUnit.set(u, cur);
  }

  let dpTotal = 0;
  let dpVolumeTotal = 0;
  let revenueTotal = 0;
  let withRes = 0;
  let withoutRes = 0;

  const rows = units.map((un) => {
    const dp = dpValue(un.bedrooms);
    dpTotal += dp;
    const agg = byUnit.get(un.unitName) ?? { count: 0, revenue: 0 };
    if (agg.count > 0) withRes++;
    else withoutRes++;
    const dpVol = dp * agg.count;
    dpVolumeTotal += dpVol;
    revenueTotal += agg.revenue;
    return {
      unit: un.unitName,
      bedrooms: un.bedrooms,
      dp,
      resCount: agg.count,
      dpVolume: dpVol,
      revenue: agg.revenue,
    };
  });

  return {
    rows,
    withRes,
    withoutRes,
    dpTotal,
    dpVolumeTotal,
    revenueTotal,
  };
}
