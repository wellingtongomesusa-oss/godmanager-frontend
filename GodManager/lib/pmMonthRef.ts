/**
 * Mês de referência em pm_expenses pode ser "YYYY-MM" ou "YYYY-M".
 * Querys devem aceitar as variantes do mesmo mês.
 * Na escrita, preferir sempre YYYY com mês com dois dígitos.
 */
export function normalizeYearMonthForWrite(raw: string): string | null {
  const t = String(raw || '').trim();
  const m = /^(\d{4})-(\d{1,2})$/.exec(t);
  if (!m) return null;
  const y = m[1];
  const n = parseInt(m[2], 10);
  if (n < 1 || n > 12) return null;
  return `${y}-${String(n).padStart(2, '0')}`;
}

export function monthRefQueryValues(yearMonth: string): string[] {
  const t = String(yearMonth || '').trim();
  const m = /^(\d{4})-(\d{1,2})$/.exec(t);
  if (!m) return [t].filter(Boolean);
  const y = m[1];
  const n = parseInt(m[2], 10);
  if (n < 1 || n > 12) return [t];
  const padded = `${y}-${String(n).padStart(2, '0')}`;
  const unpadded = `${y}-${n}`;
  return Array.from(new Set([padded, unpadded, t]));
}
