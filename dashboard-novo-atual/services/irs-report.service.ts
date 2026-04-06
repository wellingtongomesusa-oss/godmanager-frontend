/**
 * IRS Report Service – dashboard-novo
 * Dados para relatórios fiscais e export PDF/CSV. Integra com tax-validation e irs-status.
 * Em produção: IRS Transcripts, MeF, Mastercard Insights, Plaid para categorização.
 */

import { getFilings, getPaymentHistory, getNotices, getFederalTaxStatus } from './irs-status.service';

export interface TaxReportFilters {
  taxYear?: number;
  taxpayerId?: string;
}

export interface TaxReportSummary {
  generatedAt: string;
  taxYear: number;
  taxpayerId: string;
  annualIncome: number;
  deductibleExpenses: number;
  estimatedPayments: number;
  priorYearLiability: number;
  projectedTaxDue: number;
  obligationsPending: number;
  deductionsSummary: Record<string, number>;
}

const currentYear = new Date().getFullYear();

/** Dados mock para relatório fiscal (receita, despesas, deduções). */
function getMockTaxData(taxYear: number): Omit<TaxReportSummary, 'generatedAt' | 'taxYear' | 'taxpayerId'> {
  return {
    annualIncome: 185000,
    deductibleExpenses: 42000,
    estimatedPayments: 28000,
    priorYearLiability: 32000,
    projectedTaxDue: 18500,
    obligationsPending: 4500,
    deductionsSummary: {
      'Business expenses': 18000,
      'Home office': 4200,
      'Health insurance': 8400,
      'Retirement (SEP)': 12000,
      'Other': -100,
    },
  };
}

/**
 * Retorna dados consolidados para relatório fiscal.
 */
export function getTaxReportData(filters: TaxReportFilters = {}): TaxReportSummary {
  const taxYear = filters.taxYear ?? currentYear;
  const taxpayerId = filters.taxpayerId ?? 'XX-XXXXXXX';
  const status = getFederalTaxStatus(taxpayerId, taxYear);
  const mock = getMockTaxData(taxYear);
  return {
    generatedAt: new Date().toISOString(),
    taxYear,
    taxpayerId,
    annualIncome: mock.annualIncome,
    deductibleExpenses: mock.deductibleExpenses,
    estimatedPayments: status.estimatedPayments,
    priorYearLiability: mock.priorYearLiability,
    projectedTaxDue: mock.projectedTaxDue,
    obligationsPending: status.balanceDue,
    deductionsSummary: mock.deductionsSummary,
  };
}

/**
 * Retorna filings para tabela no relatório.
 */
export function getTaxReportFilings(filters: TaxReportFilters = {}) {
  const taxYear = filters.taxYear ?? currentYear;
  return getFilings(taxYear);
}

/**
 * Retorna pagamentos para tabela no relatório.
 */
export function getTaxReportPayments(filters: TaxReportFilters = {}) {
  const taxYear = filters.taxYear ?? currentYear;
  return getPaymentHistory(taxYear);
}

/**
 * Retorna notificações para relatório.
 */
export function getTaxReportNotices(filters: TaxReportFilters = {}) {
  return getNotices();
}
