/**
 * GAAP Service – dashboard-novo
 * Consolida dados do cliente, armazena relatórios GAAP mensais (mock).
 * Trocar por API em produção.
 */

import { defaultCompany } from '@/lib/company';

export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';
export type ReportingMonth = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface GaapClientInfo {
  clientName: string;
  businessName: string;
  einOrSsn: string;
  address: string;
  country: string;
  email: string;
  phone: string;
  accountCreationDate: string;
  lastUpdateDate: string;
}

export interface GaapReportingPeriod {
  month: ReportingMonth;
  year: number;
  periodStart: string;
  periodEnd: string;
}

export interface GaapRevenue {
  grossRevenue: number;
  adjustedRevenue: number;
  deferredRevenue: number;
  notes: string;
}

export interface GaapExpenses {
  operatingExpenses: number;
  payrollExpenses: number;
  administrativeExpenses: number;
  marketingExpenses: number;
  depreciationAmortization: number;
  otherExpenses: number;
  notes: string;
}

export interface GaapAssets {
  currentAssets: number;
  fixedAssets: number;
  intangibleAssets: number;
  accumulatedDepreciation: number;
  notes: string;
}

export interface GaapLiabilities {
  currentLiabilities: number;
  longTermLiabilities: number;
  accountsPayable: number;
  notesPayable: number;
  otherLiabilities: number;
  notes: string;
}

export interface GaapEquity {
  ownersEquity: number;
  retainedEarnings: number;
  capitalContributions: number;
  withdrawals: number;
  notes: string;
}

export interface GaapComplianceChecklist {
  revenueRecognitionAsc606: boolean;
  expenseMatchingPrinciple: boolean;
  fullDisclosurePrinciple: boolean;
  materialityPrinciple: boolean;
  consistencyPrinciple: boolean;
  conservatismPrinciple: boolean;
}

export interface GaapFinalization {
  preparedBy: string;
  reviewedBy: string;
  approvalStatus: ApprovalStatus;
  notes: string;
}

export interface GaapReport {
  id: string;
  client: GaapClientInfo;
  period: GaapReportingPeriod;
  revenue: GaapRevenue;
  expenses: GaapExpenses;
  assets: GaapAssets;
  liabilities: GaapLiabilities;
  equity: GaapEquity;
  compliance: GaapComplianceChecklist;
  finalization: GaapFinalization;
  createdAt: string;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function periodStartEnd(month: ReportingMonth, year: number): { start: string; end: string } {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

/** Mock client – em produção buscar do sistema por cliente selecionado. */
export function getGaapClientMock(): GaapClientInfo {
  const created = '2024-06-15';
  const updated = '2025-01-20';
  return {
    clientName: 'Acme Corp',
    businessName: 'Acme Corporation',
    einOrSsn: '12-3456789',
    address: `${defaultCompany.address}, ${defaultCompany.city} ${defaultCompany.state} ${defaultCompany.zip}`,
    country: defaultCompany.country,
    email: defaultCompany.email,
    phone: defaultCompany.phone,
    accountCreationDate: created,
    lastUpdateDate: updated,
  };
}

export function getReportingYears(): number[] {
  const y = new Date().getFullYear();
  return [y, y - 1, y - 2];
}

export function getPeriodForMonthYear(month: ReportingMonth, year: number): GaapReportingPeriod {
  const { start, end } = periodStartEnd(month, year);
  return { month, year, periodStart: start, periodEnd: end };
}

export function getMonthName(m: ReportingMonth): string {
  return MONTH_NAMES[m - 1] ?? String(m);
}

let reportsStore: GaapReport[] = [];

function generateId(): string {
  return `gaap-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function listGaapReports(): GaapReport[] {
  return [...reportsStore].sort((a, b) => {
    const da = `${a.period.year}-${String(a.period.month).padStart(2, '0')}`;
    const db = `${b.period.year}-${String(b.period.month).padStart(2, '0')}`;
    return db.localeCompare(da);
  });
}

export function getGaapReportById(id: string): GaapReport | null {
  return reportsStore.find((r) => r.id === id) ?? null;
}

export function getGaapReportByPeriod(month: ReportingMonth, year: number): GaapReport | null {
  return reportsStore.find((r) => r.period.month === month && r.period.year === year) ?? null;
}

export interface GaapReportInput {
  client: GaapClientInfo;
  period: GaapReportingPeriod;
  revenue: GaapRevenue;
  expenses: GaapExpenses;
  assets: GaapAssets;
  liabilities: GaapLiabilities;
  equity: GaapEquity;
  compliance: GaapComplianceChecklist;
  finalization: GaapFinalization;
}

export function saveGaapReport(input: GaapReportInput): GaapReport {
  const existing = getGaapReportByPeriod(input.period.month, input.period.year);
  const now = new Date().toISOString();
  const report: GaapReport = {
    id: existing?.id ?? generateId(),
    client: { ...input.client },
    period: { ...input.period },
    revenue: { ...input.revenue },
    expenses: { ...input.expenses },
    assets: { ...input.assets },
    liabilities: { ...input.liabilities },
    equity: { ...input.equity },
    compliance: { ...input.compliance },
    finalization: { ...input.finalization },
    createdAt: existing?.createdAt ?? now,
  };
  if (existing) {
    reportsStore = reportsStore.filter((r) => r.id !== existing.id);
  }
  reportsStore.unshift(report);
  return report;
}

export function gaapReportToCsvRows(report: GaapReport): Record<string, string | number>[] {
  const { client, period, revenue, expenses, assets, liabilities, equity, finalization } = report;
  return [
    { Section: 'Client', Field: 'Client Name', Value: client.clientName },
    { Section: 'Client', Field: 'Business Name', Value: client.businessName },
    { Section: 'Client', Field: 'EIN/SSN', Value: client.einOrSsn },
    { Section: 'Client', Field: 'Address', Value: client.address },
    { Section: 'Client', Field: 'Country', Value: client.country },
    { Section: 'Client', Field: 'Email', Value: client.email },
    { Section: 'Client', Field: 'Phone', Value: client.phone },
    { Section: 'Period', Field: 'Month', Value: getMonthName(period.month) },
    { Section: 'Period', Field: 'Year', Value: period.year },
    { Section: 'Period', Field: 'Start', Value: period.periodStart },
    { Section: 'Period', Field: 'End', Value: period.periodEnd },
    { Section: 'Revenue', Field: 'Gross Revenue', Value: revenue.grossRevenue },
    { Section: 'Revenue', Field: 'Adjusted Revenue', Value: revenue.adjustedRevenue },
    { Section: 'Revenue', Field: 'Deferred Revenue', Value: revenue.deferredRevenue },
    { Section: 'Expenses', Field: 'Operating', Value: expenses.operatingExpenses },
    { Section: 'Expenses', Field: 'Payroll', Value: expenses.payrollExpenses },
    { Section: 'Expenses', Field: 'Administrative', Value: expenses.administrativeExpenses },
    { Section: 'Expenses', Field: 'Marketing', Value: expenses.marketingExpenses },
    { Section: 'Expenses', Field: 'Depreciation & Amortization', Value: expenses.depreciationAmortization },
    { Section: 'Expenses', Field: 'Other', Value: expenses.otherExpenses },
    { Section: 'Assets', Field: 'Current', Value: assets.currentAssets },
    { Section: 'Assets', Field: 'Fixed', Value: assets.fixedAssets },
    { Section: 'Assets', Field: 'Intangible', Value: assets.intangibleAssets },
    { Section: 'Assets', Field: 'Accumulated Depreciation', Value: assets.accumulatedDepreciation },
    { Section: 'Liabilities', Field: 'Current', Value: liabilities.currentLiabilities },
    { Section: 'Liabilities', Field: 'Long-term', Value: liabilities.longTermLiabilities },
    { Section: 'Liabilities', Field: 'Accounts Payable', Value: liabilities.accountsPayable },
    { Section: 'Liabilities', Field: 'Notes Payable', Value: liabilities.notesPayable },
    { Section: 'Liabilities', Field: 'Other', Value: liabilities.otherLiabilities },
    { Section: 'Equity', Field: "Owner's Equity", Value: equity.ownersEquity },
    { Section: 'Equity', Field: 'Retained Earnings', Value: equity.retainedEarnings },
    { Section: 'Equity', Field: 'Capital Contributions', Value: equity.capitalContributions },
    { Section: 'Equity', Field: 'Withdrawals', Value: equity.withdrawals },
    { Section: 'Finalization', Field: 'Prepared By', Value: finalization.preparedBy },
    { Section: 'Finalization', Field: 'Reviewed By', Value: finalization.reviewedBy },
    { Section: 'Finalization', Field: 'Approval Status', Value: finalization.approvalStatus },
  ];
}
