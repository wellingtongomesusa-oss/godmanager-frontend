/** Taxa anual fixa (antecipação de aluguel) — configurável */
export const TAXA_ANUAL = 0.18;

export function monthlyRateFromAnnual(annual = TAXA_ANUAL): number {
  return Math.pow(1 + annual, 1 / 12) - 1;
}

export type RentAdvanceScheduleRow = {
  month: number;
  dateISO: string;
  rentGross: number;
  discountFactor: number;
  presentValue: number;
};

export type RentAdvanceResult = {
  grossAmount: number;
  presentValue: number;
  totalDiscount: number;
  monthlyRate: number;
  annualRate: number;
  effectiveDiscountPct: number;
  schedule: RentAdvanceScheduleRow[];
  periodStart: string;
  periodEnd: string;
};

/** VP = Σ PMT/(1+i)^n, n=1..N. PMT = rent NET mensal. */
export function computeRentAdvance(
  months: number,
  netMonthly: number,
  annualRate = TAXA_ANUAL,
  anchorDate = new Date(),
): RentAdvanceResult {
  const N = Math.floor(months);
  const pmt = Number(netMonthly);
  if (N < 1 || N > 24 || !Number.isFinite(pmt) || pmt <= 0) {
    throw new Error('Invalid months (1–24) or netMonthly');
  }
  const i = monthlyRateFromAnnual(annualRate);
  const grossAmount = N * pmt;
  const schedule: RentAdvanceScheduleRow[] = [];
  let presentValue = 0;

  const start = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  start.setMonth(start.getMonth() + 1);

  for (let n = 1; n <= N; n++) {
    const factor = 1 / Math.pow(1 + i, n);
    const pv = pmt * factor;
    presentValue += pv;
    const d = new Date(start.getFullYear(), start.getMonth() + (n - 1), 1);
    schedule.push({
      month: n,
      dateISO: d.toISOString().slice(0, 10),
      rentGross: pmt,
      discountFactor: factor,
      presentValue: pv,
    });
  }

  const periodStart = schedule[0]?.dateISO ?? '';
  const last = schedule[schedule.length - 1];
  let periodEnd = periodStart;
  if (last) {
    const [y, m] = last.dateISO.split('-').map(Number);
    const end = new Date(y, m, 0);
    periodEnd = end.toISOString().slice(0, 10);
  }

  const totalDiscount = grossAmount - presentValue;
  return {
    grossAmount,
    presentValue,
    totalDiscount,
    monthlyRate: i,
    annualRate,
    effectiveDiscountPct: grossAmount > 0 ? (totalDiscount / grossAmount) * 100 : 0,
    schedule,
    periodStart,
    periodEnd,
  };
}
