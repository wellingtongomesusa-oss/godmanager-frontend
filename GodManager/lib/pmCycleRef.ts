/**
 * Manager Prop closing cycle: each month runs from day 15 of
 * the previous month to day 14 of the current month. The cycle
 * is referenced by its START month (the month it began on).
 *
 * Examples:
 *   serviceDate 2026-03-20 -> ciclo 15-mar a 15-abr -> monthRef 2026-03
 *   serviceDate 2026-04-10 -> ciclo 15-mar a 15-abr -> monthRef 2026-03
 *   serviceDate 2026-04-15 -> ciclo 15-abr a 15-mai -> monthRef 2026-04
 *   serviceDate 2026-04-30 -> ciclo 15-abr a 15-mai -> monthRef 2026-04
 *   serviceDate 2026-05-14 -> ciclo 15-abr a 15-mai -> monthRef 2026-04
 *   serviceDate 2026-05-15 -> ciclo 15-mai a 15-jun -> monthRef 2026-05
 */
export function serviceDateToMonthRef(date: Date | string | null | undefined): string | null {
  if (!date) return null;

  const d = typeof date === 'string' ? new Date(date) : date;
  if (!d || Number.isNaN(d.getTime())) return null;

  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1; // 1-12
  const day = d.getUTCDate();

  // Day < 15 belongs to previous month's cycle
  if (day < 15) {
    if (month === 1) {
      return String(year - 1) + '-12';
    }
    return String(year) + '-' + String(month - 1).padStart(2, '0');
  }

  // Day >= 15 belongs to current month's cycle
  return String(year) + '-' + String(month).padStart(2, '0');
}

/**
 * Returns the start and end dates of a closing cycle for a
 * given monthRef (YYYY-MM). Cycle starts day 15 of monthRef
 * and ends day 14 of the following month.
 */
export function monthRefToCycleRange(monthRef: string): { start: Date; end: Date } | null {
  const m = /^(\d{4})-(\d{1,2})$/.exec(String(monthRef || '').trim());
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (month < 1 || month > 12) return null;

  const start = new Date(Date.UTC(year, month - 1, 15));
  const endYear = month === 12 ? year + 1 : year;
  const endMonth = month === 12 ? 1 : month + 1;
  const end = new Date(Date.UTC(endYear, endMonth - 1, 14, 23, 59, 59, 999));

  return { start, end };
}
