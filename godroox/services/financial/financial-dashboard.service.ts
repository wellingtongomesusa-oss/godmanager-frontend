/**
 * Financial Dashboard Service
 * GAAP, SOX 404, ICFR, IPO Readiness - KPMG/Deloitte/PwC/EY methodologies
 */

export interface DashboardKpi {
  label: string;
  value: string | number;
  changePercent?: number;
  trend?: 'up' | 'down' | 'neutral';
  status?: 'good' | 'warning' | 'critical';
}

export interface AgingBucket {
  range: string;
  amount: number;
  count: number;
  percent: number;
}

export interface MonthEndCloseStatus {
  period: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'PENDING_REVIEW' | 'COMPLETED';
  progress: number;
  tasksTotal: number;
  tasksCompleted: number;
}

export interface SoxComplianceMetric {
  metric: string;
  value: number;
  target: number;
  status: 'compliant' | 'partial' | 'non_compliant';
}

export interface IcfrMaturityLevel {
  component: string;
  level: number; // 1-5 KPMG maturity model
  label: string;
  status: 'mature' | 'developing' | 'initial';
}

export function getExecutiveKpis(): DashboardKpi[] {
  return [
    { label: 'Receita (MTD)', value: '$2.45M', changePercent: 12.3, trend: 'up', status: 'good' },
    { label: 'Despesas (MTD)', value: '$1.82M', changePercent: -3.1, trend: 'down', status: 'good' },
    { label: 'Lucro Líquido', value: '$630K', changePercent: 8.7, trend: 'up', status: 'good' },
    { label: 'Margem Líquida', value: '25.7%', changePercent: 1.2, trend: 'up', status: 'good' },
    { label: 'Fluxo de Caixa', value: '$412K', changePercent: -5.4, trend: 'down', status: 'warning' },
  ];
}

export function getAgingAP(): AgingBucket[] {
  return [
    { range: 'Current', amount: 125000, count: 45, percent: 62 },
    { range: '1-30 days', amount: 45000, count: 12, percent: 22 },
    { range: '31-60 days', amount: 18000, count: 5, percent: 9 },
    { range: '61-90 days', amount: 8000, count: 3, percent: 4 },
    { range: '90+ days', amount: 4000, count: 2, percent: 3 },
  ];
}

export function getAgingAR(): AgingBucket[] {
  return [
    { range: 'Current', amount: 185000, count: 52, percent: 68 },
    { range: '1-30 days', amount: 52000, count: 15, percent: 19 },
    { range: '31-60 days', amount: 22000, count: 6, percent: 8 },
    { range: '61-90 days', amount: 8000, count: 3, percent: 3 },
    { range: '90+ days', amount: 5000, count: 2, percent: 2 },
  ];
}

export function getMonthEndCloseStatus(): MonthEndCloseStatus {
  return {
    period: '2025-03',
    status: 'IN_PROGRESS',
    progress: 72,
    tasksTotal: 25,
    tasksCompleted: 18,
  };
}

export function getRiskAlerts(): { id: string; severity: string; message: string; date: string }[] {
  return [
    { id: '1', severity: 'high', message: '3 invoices AP overdue 60+ days', date: '2025-03-08' },
    { id: '2', severity: 'medium', message: 'Bank reconciliation pending for 2 accounts', date: '2025-03-09' },
    { id: '3', severity: 'low', message: '2 journal entries awaiting dual approval', date: '2025-03-10' },
  ];
}

export function getSoxComplianceMetrics(): SoxComplianceMetric[] {
  return [
    { metric: 'Controles Implementados', value: 94, target: 100, status: 'compliant' },
    { metric: 'Testes Concluídos', value: 88, target: 100, status: 'partial' },
    { metric: 'Deficiências Abertas', value: 2, target: 0, status: 'partial' },
    { metric: 'Documentação ICFR', value: 100, target: 100, status: 'compliant' },
  ];
}

export function getIcfrMaturityLevels(): IcfrMaturityLevel[] {
  return [
    { component: 'Control Environment', level: 4, label: 'Managed', status: 'mature' },
    { component: 'Risk Assessment', level: 4, label: 'Managed', status: 'mature' },
    { component: 'Control Activities', level: 3, label: 'Defined', status: 'developing' },
    { component: 'Information & Communication', level: 4, label: 'Managed', status: 'mature' },
    { component: 'Monitoring Activities', level: 3, label: 'Defined', status: 'developing' },
  ];
}
