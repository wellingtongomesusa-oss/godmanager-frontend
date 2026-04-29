export type PropertyStatusCode = 'WTC' | 'ADM' | 'INT' | 'ALG' | 'VG';

export const PROPERTY_STATUS_LABELS: Record<PropertyStatusCode, string> = {
  WTC: 'Watching',
  ADM: 'Adm HOA',
  INT: 'Intermediação',
  ALG: 'Alugada',
  VG: 'Vaga',
};

export interface PropertyForStatus {
  tenant?: string | null;
  rent?: number | string | null;
  deposit?: number | string | null;
  mgmpct?: number | string | null;
  mgmtFeePct?: number | string | null;
}

function num(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return isFinite(n) ? n : 0;
}

function hasTenant(t: unknown): boolean {
  return typeof t === 'string' && t.trim().length > 0;
}

export function computePropertyStatus(p: PropertyForStatus): PropertyStatusCode {
  const rent = num(p.rent);
  const deposit = num(p.deposit);
  const mgm = num(p.mgmpct ?? p.mgmtFeePct);
  const tenant = hasTenant(p.tenant);

  if (mgm === 0 && deposit === 0 && rent === 0) return 'WTC';
  if (mgm === 10) return 'ADM';
  if (rent > 0 && !tenant) return 'INT';
  if (tenant) return 'ALG';
  return 'VG';
}

export function statusBadgeColor(code: PropertyStatusCode): string {
  switch (code) {
    case 'ALG':
      return '#22c55e';
    case 'VG':
      return '#94a3b8';
    case 'ADM':
      return '#3b82f6';
    case 'WTC':
      return '#f59e0b';
    case 'INT':
      return '#a855f7';
  }
}
