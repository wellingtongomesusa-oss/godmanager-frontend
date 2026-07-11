/**
 * Fórmulas de rentabilidade imobiliária (Invest Home). Puro/testável.
 * Segue EXATAMENTE o spec. Todos os valores monetários em USD; percentuais são
 * razões (iguais em qualquer moeda).
 */

export interface InvestAssumptions {
  downPct: number; // entrada (0..1) — ex.: 0.25
  rate: number; // juros a.a. (0..1) — ex.: 0.07
  termYears: number; // prazo — ex.: 30
  opexPct: number; // custos operacionais como % da receita (0..1)
  revenueBasis: 'gross' | 'owner' | 'payouts';
}

export const DEFAULT_ASSUMPTIONS: InvestAssumptions = {
  downPct: 0.25,
  rate: 0.07,
  termYears: 30,
  opexPct: 0,
  revenueBasis: 'gross',
};

/** Parcela mensal (Price/amortização francesa). rate a.a., termYears anos. */
export function mortgageMonthly(loan: number, rate: number, termYears: number): number {
  const n = termYears * 12;
  if (n <= 0) return 0;
  const r = rate / 12;
  if (r === 0) return loan / n;
  return (loan * r) / (1 - Math.pow(1 + r, -n));
}

export interface InvestInputs {
  value: number; // V — valor do imóvel (USD); 0 = sem valor
  reservasTotal: number; // comissão (período)
  ownerTotal: number; // owner pago (período)
  payoutsTotal: number; // payouts por casa (período)
  monthsWithData: number; // nº de meses com dados no período
}

export interface InvestMetrics {
  hasValue: boolean;
  revenueAnnual: number | null;
  opex: number | null;
  noi: number | null;
  entrada: number | null;
  loan: number | null;
  monthlyPayment: number | null;
  annualDebtService: number | null;
  cashFlowAnnual: number | null;
  capRate: number | null; // ROI (sem alavancagem)
  cashOnCash: number | null; // ROIC (com financiamento)
  dscr: number | null;
  paybackYears: number | null;
  returnAnnual: number | null; // = ROIC
  returnMonthly: number | null; // ROIC/12
  returnSemiannual: number | null; // ROIC/2
}

const BLANK: InvestMetrics = {
  hasValue: false,
  revenueAnnual: null,
  opex: null,
  noi: null,
  entrada: null,
  loan: null,
  monthlyPayment: null,
  annualDebtService: null,
  cashFlowAnnual: null,
  capRate: null,
  cashOnCash: null,
  dscr: null,
  paybackYears: null,
  returnAnnual: null,
  returnMonthly: null,
  returnSemiannual: null,
};

export function baseRevenueSum(inp: InvestInputs, basis: InvestAssumptions['revenueBasis']): number {
  if (basis === 'owner') return inp.ownerTotal;
  if (basis === 'payouts') return inp.payoutsTotal;
  return inp.reservasTotal + inp.ownerTotal; // gross
}

export function computeInvestMetrics(inp: InvestInputs, a: InvestAssumptions): InvestMetrics {
  const V = Number(inp.value) || 0;
  if (V <= 0) return { ...BLANK };

  const months = Math.max(1, Number(inp.monthsWithData) || 1);
  const sumBase = baseRevenueSum(inp, a.revenueBasis);
  const revenueAnnual = (sumBase * 12) / months;

  const opex = revenueAnnual * (a.opexPct || 0);
  const noi = revenueAnnual - opex;

  const entrada = V * a.downPct;
  const loan = V - entrada;
  const monthlyPayment = mortgageMonthly(loan, a.rate, a.termYears);
  const annualDebtService = monthlyPayment * 12;

  const cashFlowAnnual = noi - annualDebtService;
  const capRate = noi / V;
  const cashOnCash = entrada > 0 ? cashFlowAnnual / entrada : null;
  const dscr = annualDebtService > 0 ? noi / annualDebtService : null;
  const paybackYears = cashFlowAnnual > 0 ? entrada / cashFlowAnnual : null;

  return {
    hasValue: true,
    revenueAnnual,
    opex,
    noi,
    entrada,
    loan,
    monthlyPayment,
    annualDebtService,
    cashFlowAnnual,
    capRate,
    cashOnCash,
    dscr,
    paybackYears,
    returnAnnual: cashOnCash,
    returnMonthly: cashOnCash != null ? cashOnCash / 12 : null,
    returnSemiannual: cashOnCash != null ? cashOnCash / 2 : null,
  };
}

/** Normaliza endereço → norm_unit (lowercase, não-alfanumérico vira espaço). */
export function normUnit(s: string | null | undefined): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
