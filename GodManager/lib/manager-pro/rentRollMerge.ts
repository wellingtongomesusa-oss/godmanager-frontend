/**
 * Chave de unidade para merge:
 * - tenant_directory: td['Unit'] normalizado
 * - rent_roll: rr_unit_short = parte antes de " - " na coluna Unit
 * Match: unitKey(td.Unit) === unitKey(rr.Unit)
 */
export function unitKey(raw: string): string {
  return String(raw || '')
    .split(' - ')[0]
    .trim()
    .toLowerCase();
}

export function parseMoney(s: string | undefined): number {
  if (s == null || s === '') return 0;
  const t = String(s).replace(/[$\s]/g, '').replace(/,/g, '');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

/** Busca valor em linha CSV com vários nomes possíveis de coluna */
export function cell(
  row: Record<string, string>,
  ...candidates: string[]
): string {
  const keys = Object.keys(row);
  const norm = (x: string) => x.toLowerCase().replace(/\s+/g, ' ').trim();
  for (const c of candidates) {
    const nc = norm(c);
    for (const k of keys) {
      if (norm(k) === nc) return String(row[k] ?? '');
    }
    if (row[c] != null && row[c] !== '') return String(row[c]);
  }
  return '';
}

/** Apenas Primary Tenant == Yes (evita co-inquilinos duplicando KPIs) */
export function isPrimaryTenant(row: Record<string, string>): boolean {
  const v = cell(row, 'Primary Tenant', 'primary tenant', 'Primary', 'Is Primary').trim().toLowerCase();
  return v === 'yes';
}

export function tenantStatus(row: Record<string, string>): string {
  return cell(row, 'Status', 'status', 'Tenant Status').toLowerCase();
}

/**
 * Total de casas: unit_directory.csv
 * Parse:
 * - Ignorar linhas em que Unit Name contém '->' (headers/seções)
 * - Ignorar linha Total (final ou Unit Name = Total / Grand Total)
 * - Contar linhas restantes = unidades reais (ex.: 90)
 */
export function countUnitDirectoryRows(rows: Record<string, string>[]): number {
  let n = 0;
  for (const r of rows) {
    const unitName = cell(
      r,
      'Unit Name',
      'Unit name',
      'UnitName',
      'Unit',
      'unit',
      'Property Unit'
    ).trim();

    if (!unitName) {
      const values = Object.values(r).map((v) => String(v ?? '').trim());
      if (values.every((v) => !v)) continue;
      continue;
    }

    if (unitName.includes('->')) continue;

    const uLower = unitName.toLowerCase();
    if (uLower === 'total' || uLower === 'grand total') continue;
    if (/^total$/i.test(unitName.trim())) continue;

    n++;
  }
  return n;
}

/**
 * Past Due: APENAS rent_roll — uma entrada por rr_unit_short (sem cruzar com tenant_directory).
 * Várias linhas do RR para a mesma unidade: usa o máximo (evita somar duplicata tipo $17k+17k).
 */
export function pastDueByUnit(rentRoll: Record<string, string>[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rentRoll) {
    const uRaw = cell(r, 'Unit', 'unit', 'Property', 'Unit Name');
    const key = unitKey(uRaw);
    if (!key) continue;
    const pd = parseMoney(cell(r, 'Past Due', 'Past Due Balance', 'past_due', 'PastDue'));
    if (pd > 0) {
      const prev = map.get(key) ?? 0;
      map.set(key, Math.max(prev, pd));
    }
  }
  return map;
}

/** Soma total Past Due só a partir do mapa do rent_roll (1× por unidade) */
export function sumPastDueFromRentRoll(map: Map<string, number>): number {
  let s = 0;
  for (const v of map.values()) s += v;
  return s;
}

export type TenantFilter = 'all' | 'current' | 'past_due' | 'notice' | 'nsf_late';

export function matchesTenantFilter(
  filter: TenantFilter,
  statusNorm: string,
  pastDue: number,
  nsf: boolean,
  late: boolean
): boolean {
  const x = statusNorm.toLowerCase();
  if (filter === 'all') return true;
  if (filter === 'current') {
    if (x.includes('notice') || x.includes('past')) return false;
    return x.includes('current');
  }
  if (filter === 'notice') return x.includes('notice');
  if (filter === 'past_due') return pastDue > 0;
  if (filter === 'nsf_late') return nsf || late;
  return true;
}
