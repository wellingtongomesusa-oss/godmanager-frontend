'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/language-context';
import { formatCurrency, cn } from '@/lib/utils';
import type { ApReportFilters, ApKpi } from '@/services/reports/ap-reports.service';
import {
  getApKpis,
  getMonthlyApTrends,
  getVendorConcentration,
  getMastercardInsightsSpend,
  getApHeatmapData,
  getApReportData,
} from '@/services/reports/ap-reports.service';
import { downloadApReportPdf } from '@/services/reports/ap-report-pdf';
import { downloadCsv } from '@/lib/csv-export';
import { sendApReportEmail } from '@/services/email';
import { ApLineChart, ApBarChart, ApPieChart, ApHeatmap } from './ap-charts';

export function ApReportPage() {
  const { t } = useLanguage();
  const [filters, setFilters] = useState<ApReportFilters>({});
  const [emailTo, setEmailTo] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const kpis = useMemo(() => getApKpis(filters), [filters]);
  const monthlyTrends = useMemo(() => getMonthlyApTrends(filters), [filters]);
  const vendorConcentration = useMemo(() => getVendorConcentration(filters, 10), [filters]);
  const mastercardInsights = useMemo(() => getMastercardInsightsSpend(filters), [filters]);
  const heatmapData = useMemo(() => getApHeatmapData(filters), [filters]);

  const handleFilter = useCallback((key: keyof ApReportFilters, value: string | undefined) => {
    setFilters((f) => ({ ...f, [key]: value || undefined }));
  }, []);

  const handleExportPdf = useCallback(() => {
    downloadApReportPdf(filters);
  }, [filters]);

  const handleExportCsv = useCallback(() => {
    const data = getApReportData(filters);
    const rows: Record<string, string | number | null | undefined>[] = [
      { Metric: 'Total Outstanding', Value: data.totalOutstanding, Percent: null },
      { Metric: 'Total Paid', Value: data.totalPaid, Percent: null },
      { Metric: 'Overdue Total', Value: data.overdueTotal, Percent: null },
      { Metric: 'Payment Cycle (days)', Value: data.paymentCycleDays, Percent: null },
      ...data.vendorConcentration.map((v) => ({ Metric: `Vendor: ${v.vendor}`, Value: v.amount, Percent: v.percent })),
    ];
    downloadCsv(rows, `ap-report-${new Date().toISOString().slice(0, 10)}.csv`);
  }, [filters]);

  const handleShare = useCallback(() => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/admin/reports/ap` : '';
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  }, []);

  const handleEmailReport = useCallback(async () => {
    if (!emailTo.trim()) {
      alert('Enter email address.');
      return;
    }
    setEmailSending(true);
    try {
      const res = await sendApReportEmail(emailTo);
      if (res.success) alert(t('inv.email.success'));
      else alert(t('inv.email.error') + (res.error ? `: ${res.error}` : ''));
    } finally {
      setEmailSending(false);
    }
  }, [emailTo, t]);

  const formatKpiValue = (k: ApKpi) => {
    if (typeof k.value !== 'number') return String(k.value);
    if (k.key === 'cycleTime' || k.key === 'overdueCount') return k.value.toLocaleString();
    return formatCurrency(k.value, 'USD');
  };

  return (
    <div className="space-y-8">
      <Card variant="default" className="border-secondary-200 bg-white shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-secondary-800">Filtros</CardTitle>
          <p className="text-sm text-secondary-500">Ajuste o período e o fornecedor para refinar os relatórios.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <Input
              label={t('bills.filters.dateFrom')}
              type="date"
              value={filters.dateFrom ?? ''}
              onChange={(e) => handleFilter('dateFrom', e.target.value)}
              className="max-w-[160px]"
            />
            <Input
              label={t('bills.filters.dateTo')}
              type="date"
              value={filters.dateTo ?? ''}
              onChange={(e) => handleFilter('dateTo', e.target.value)}
              className="max-w-[160px]"
            />
            <Input
              label={t('bills.filters.vendor')}
              value={filters.vendor ?? ''}
              onChange={(e) => handleFilter('vendor', e.target.value)}
              placeholder="Vendor"
              className="max-w-[180px]"
            />
            <div className="flex flex-wrap items-end gap-2 pb-2">
              <Button variant="outline" size="sm" onClick={handleExportPdf}>
                Export PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCsv}>
                Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handleShare}>
                {shareCopied ? 'Copied!' : 'Share'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-secondary-800">Indicadores (KPIs)</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {kpis.map((k) => (
            <Card key={k.key} variant="elevated" className="overflow-hidden border-secondary-200 shadow-md transition-shadow hover:shadow-lg">
              <CardContent className="p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-secondary-500">{k.label}</p>
                <p className={cn('mt-2 text-2xl font-bold tabular-nums text-secondary-900 sm:text-3xl')}>
                  {formatKpiValue(k)}
                </p>
                {k.changePercent != null && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-secondary-500">
                    <span className={cn('font-medium', k.changePercent >= 0 ? 'text-success-600' : 'text-danger-600')}>
                      {k.changePercent >= 0 ? '↑' : '↓'} {Math.abs(k.changePercent).toFixed(1)}%
                    </span>
                    <span>vs last period</span>
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-secondary-800">Gráficos</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <ApLineChart data={monthlyTrends} title="Monthly A/P Trends" />
          <ApBarChart data={vendorConcentration} title="Vendor Concentration" />
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <ApPieChart data={mastercardInsights} title="Spend by Category (Mastercard Insights)" />
          <ApHeatmap
            vendors={heatmapData.vendors}
            months={heatmapData.months}
            values={heatmapData.values}
            title="Vendor x Month (Heatmap)"
          />
        </div>
      </div>

      <Card variant="default" className="border-secondary-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-secondary-800">Enviar relatório por e-mail</CardTitle>
          <p className="text-sm text-secondary-500">Envie o relatório A/P por e-mail (simulação).</p>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <Input
            label="E-mail"
            type="email"
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
            placeholder="destinatario@exemplo.com"
            className="max-w-[280px]"
          />
          <Button onClick={handleEmailReport} disabled={emailSending} size="md">
            {emailSending ? 'Enviando...' : 'Email Report'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
