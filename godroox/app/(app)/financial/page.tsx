'use client';

import {
  DashboardKpiCards,
  AgingChart,
  MonthCloseStatus,
  RiskAlerts,
  SoxCompliance,
  IcfrMaturity,
} from '@/components/financial';
import {
  getExecutiveKpis,
  getAgingAP,
  getAgingAR,
  getMonthEndCloseStatus,
  getRiskAlerts,
  getSoxComplianceMetrics,
  getIcfrMaturityLevels,
} from '@/services/financial/financial-dashboard.service';

export default function FinancialDashboardPage() {
  const kpis = getExecutiveKpis();
  const agingAP = getAgingAP();
  const agingAR = getAgingAR();
  const monthClose = getMonthEndCloseStatus();
  const alerts = getRiskAlerts();
  const soxMetrics = getSoxComplianceMetrics();
  const icfrLevels = getIcfrMaturityLevels();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">
          Dashboard Financeiro
        </h1>
        <p className="mt-1 text-secondary-600">
          Indicadores executivos • GAAP • SOX 404 • ICFR • IPO Readiness
        </p>
      </div>

      {/* KPIs Executivos */}
      <DashboardKpiCards kpis={kpis} />

      {/* Aging AP/AR e Fechamento */}
      <div className="grid gap-6 lg:grid-cols-3">
        <AgingChart
          title="Aging AP (Contas a Pagar)"
          data={agingAP}
          totalLabel="Total:"
        />
        <AgingChart
          title="Aging AR (Contas a Receber)"
          data={agingAR}
          totalLabel="Total:"
        />
        <MonthCloseStatus data={monthClose} />
      </div>

      {/* SOX, ICFR e Alertas */}
      <div className="grid gap-6 lg:grid-cols-3">
        <SoxCompliance metrics={soxMetrics} />
        <IcfrMaturity levels={icfrLevels} />
        <RiskAlerts alerts={alerts} />
      </div>
    </div>
  );
}
