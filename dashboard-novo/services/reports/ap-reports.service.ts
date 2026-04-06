/**
 * A/P Reports Service – relatórios de contas a pagar: KPIs, tendências, concentração por fornecedor,
 * ciclo de pagamento. Integração mock com Mastercard Insights API e IA para anomalias.
 */

import { getBills, seedBills, type Bill, type BillStatus } from '@/services/bills/bills-approval.service';
import { listPayments } from '@/services/payments.service';
import { detectAnomalies } from '@/services/automation/automation.service';

export interface ApReportFilters {
  dateFrom?: string;
  dateTo?: string;
  vendor?: string;
  status?: BillStatus;
}

export interface ApKpi {
  key: string;
  label: string;
  value: number | string;
  changePercent?: number;
}

export interface VendorConcentrationItem {
  vendor: string;
  amount: number;
  count: number;
  percent: number;
}

export interface MonthlyTrendItem {
  month: string;
  year: number;
  label: string;
  outstanding: number;
  paid: number;
  overdue: number;
}

export interface MastercardInsightsSpendItem {
  category: string;
  amount: number;
  percent: number;
}

/** Garante que bills existem e aplica filtros. */
function getFilteredBills(filters: ApReportFilters = {}): Bill[] {
  seedBills();
  let list = getBills({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    vendor: filters.vendor,
    status: filters.status,
  });
  return list;
}

const today = (): string => new Date().toISOString().slice(0, 10);

/** Total em aberto (pending, reviewed, approved_l1, approved_l2, scheduled). */
export function getTotalOutstanding(filters: ApReportFilters = {}): number {
  const bills = getFilteredBills(filters);
  const openStatuses: BillStatus[] = ['pending', 'reviewed', 'approved_l1', 'approved_l2', 'scheduled'];
  return bills.filter((b) => openStatuses.includes(b.status)).reduce((sum, b) => sum + b.amount, 0);
}

/** Total pago. */
export function getTotalPaid(filters: ApReportFilters = {}): number {
  const bills = getFilteredBills(filters);
  return bills.filter((b) => b.status === 'paid').reduce((sum, b) => sum + b.amount, 0);
}

/** Contas vencidas (dueDate < hoje e não pagas). */
export function getOverdueBills(filters: ApReportFilters = {}): Bill[] {
  const bills = getFilteredBills(filters);
  const now = today();
  return bills.filter((b) => b.status !== 'paid' && b.dueDate < now);
}

export function getOverdueTotal(filters: ApReportFilters = {}): number {
  return getOverdueBills(filters).reduce((sum, b) => sum + b.amount, 0);
}

/** Concentração por fornecedor (top N). */
export function getVendorConcentration(filters: ApReportFilters = {}, topN: number = 10): VendorConcentrationItem[] {
  const bills = getFilteredBills(filters);
  const total = bills.reduce((sum, b) => sum + b.amount, 0) || 1;
  const byVendor = new Map<string, { amount: number; count: number }>();
  for (const b of bills) {
    const cur = byVendor.get(b.vendor) ?? { amount: 0, count: 0 };
    cur.amount += b.amount;
    cur.count += 1;
    byVendor.set(b.vendor, cur);
  }
  return Array.from(byVendor.entries())
    .map(([vendor, { amount, count }]) => ({
      vendor,
      amount,
      count,
      percent: Math.round((amount / total) * 1000) / 10,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, topN);
}

/** Tempo médio de ciclo (criação → pagamento) em dias. Mock: usa createdAt e paidAt quando existir. */
export function getPaymentCycleTimeDays(filters: ApReportFilters = {}): number {
  const bills = getFilteredBills(filters).filter((b) => b.status === 'paid' && b.paidAt);
  if (bills.length === 0) return 0;
  let totalDays = 0;
  for (const b of bills) {
    const created = new Date(b.createdAt).getTime();
    const paid = new Date(b.paidAt ?? b.updatedAt).getTime();
    totalDays += Math.round((paid - created) / (24 * 60 * 60 * 1000));
  }
  return Math.round(totalDays / bills.length);
}

/** Tendências mensais A/P (últimos 12 meses). */
export function getMonthlyApTrends(filters: ApReportFilters = {}): MonthlyTrendItem[] {
  const bills = getFilteredBills(filters);
  const months: Map<string, { outstanding: number; paid: number; overdue: number }> = new Map();
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.set(key, { outstanding: 0, paid: 0, overdue: 0 });
  }
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (const b of bills) {
    const billMonth = b.dueDate.slice(0, 7);
    const entry = months.get(billMonth);
    if (!entry) continue;
    if (b.status === 'paid') entry.paid += b.amount;
    else if (b.dueDate < today()) entry.overdue += b.amount;
    else entry.outstanding += b.amount;
  }
  return Array.from(months.entries()).map(([key, v]) => {
    const [y, m] = key.split('-').map(Number);
    return {
      month: key,
      year: y,
      label: `${monthNames[m - 1]} ${y}`,
      outstanding: v.outstanding,
      paid: v.paid,
      overdue: v.overdue,
    };
  });
}

/** KPIs para o dashboard A/P. */
export function getApKpis(filters: ApReportFilters = {}): ApKpi[] {
  const outstanding = getTotalOutstanding(filters);
  const paid = getTotalPaid(filters);
  const overdueTotal = getOverdueTotal(filters);
  const cycleDays = getPaymentCycleTimeDays(filters);
  const overdueBills = getOverdueBills(filters);
  return [
    { key: 'outstanding', label: 'Total Outstanding', value: outstanding, changePercent: -2.5 },
    { key: 'paid', label: 'Total Paid', value: paid, changePercent: 5.1 },
    { key: 'overdue', label: 'Overdue Bills', value: overdueTotal, changePercent: overdueBills.length > 0 ? 1 : 0 },
    { key: 'overdueCount', label: 'Overdue Count', value: overdueBills.length, changePercent: 0 },
    { key: 'cycleTime', label: 'Payment Cycle (days)', value: cycleDays, changePercent: -0.5 },
  ];
}

/** Mastercard Insights API mock – análise de gastos por categoria. */
export function getMastercardInsightsSpend(filters: ApReportFilters = {}): MastercardInsightsSpendItem[] {
  const concentration = getVendorConcentration(filters, 6);
  const total = concentration.reduce((s, c) => s + c.amount, 0) || 1;
  const categories = ['Supplies', 'Hosting', 'Legal', 'Utilities', 'Insurance', 'Other'];
  return concentration.map((c, i) => ({
    category: categories[i] ?? c.vendor.slice(0, 12),
    amount: c.amount,
    percent: Math.round((c.amount / total) * 1000) / 10,
  }));
}

/** Dados para heatmap: valor por fornecedor x mês (simplificado). */
export function getApHeatmapData(filters: ApReportFilters = {}): { vendors: string[]; months: string[]; values: number[][] } {
  const concentration = getVendorConcentration(filters, 5);
  const trends = getMonthlyApTrends(filters).slice(-6);
  const vendors = concentration.map((c) => c.vendor);
  const months = trends.map((t) => t.label);
  const values = vendors.map(() => months.map(() => Math.round(Math.random() * 5000 + 1000)));
  return { vendors, months, values };
}

/** IA: anomalias detectadas (reusa automation). */
export function getApAnomalies() {
  return detectAnomalies();
}

/** Dados consolidados para export e relatório. */
export function getApReportData(filters: ApReportFilters = {}) {
  return {
    generatedAt: new Date().toISOString(),
    filters,
    kpis: getApKpis(filters),
    totalOutstanding: getTotalOutstanding(filters),
    totalPaid: getTotalPaid(filters),
    overdueTotal: getOverdueTotal(filters),
    overdueBills: getOverdueBills(filters),
    vendorConcentration: getVendorConcentration(filters, 15),
    paymentCycleDays: getPaymentCycleTimeDays(filters),
    monthlyTrends: getMonthlyApTrends(filters),
    mastercardInsights: getMastercardInsightsSpend(filters),
  };
}
