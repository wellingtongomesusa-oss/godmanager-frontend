/** Extrai número inicial do endereço para ordenação natural (1, 1004, 11163…). */
export function houseNumberFromAddress(address: string | null | undefined): number | null {
  const m = String(address ?? '').trim().match(/^(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

export function comparePropertiesByHouseNumber<T extends { address?: string | null }>(
  a: T,
  b: T
): number {
  const na = houseNumberFromAddress(a.address);
  const nb = houseNumberFromAddress(b.address);
  if (na == null && nb == null) {
    return String(a.address ?? '').localeCompare(String(b.address ?? ''), 'en', {
      numeric: true,
      sensitivity: 'base',
    });
  }
  if (na == null) return 1;
  if (nb == null) return -1;
  if (na !== nb) return na - nb;
  return String(a.address ?? '').localeCompare(String(b.address ?? ''), 'en', {
    numeric: true,
    sensitivity: 'base',
  });
}
