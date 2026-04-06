'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getGaapClientMock,
  getReportingYears,
  getPeriodForMonthYear,
  saveGaapReport,
  type GaapClientInfo,
  type GaapReportingPeriod,
  type GaapRevenue,
  type GaapExpenses,
  type GaapAssets,
  type GaapLiabilities,
  type GaapEquity,
  type GaapComplianceChecklist,
  type GaapFinalization,
  type ApprovalStatus,
  type ReportingMonth,
} from '@/services/gaap.service';

const MONTHS: { value: ReportingMonth; label: string }[] = [
  { value: 1, label: 'Jan' }, { value: 2, label: 'Feb' }, { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' }, { value: 5, label: 'May' }, { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' }, { value: 8, label: 'Aug' }, { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' }, { value: 11, label: 'Nov' }, { value: 12, label: 'Dec' },
];

const APPROVAL_OPTIONS: ApprovalStatus[] = ['Pending', 'Approved', 'Rejected'];

const defaultNum = (): number => 0;
const defaultStr = (): string => '';

function useGaapForm() {
  const years = useMemo(() => getReportingYears(), []);
  const now = new Date();
  const [client, setClient] = useState<GaapClientInfo>(() => getGaapClientMock());
  const [month, setMonth] = useState<ReportingMonth>((now.getMonth() + 1) as ReportingMonth);
  const [year, setYear] = useState(now.getFullYear());
  const [revenue, setRevenue] = useState<GaapRevenue>({
    grossRevenue: 125000,
    adjustedRevenue: defaultNum(),
    deferredRevenue: defaultNum(),
    notes: defaultStr(),
  });
  const [expenses, setExpenses] = useState<GaapExpenses>({
    operatingExpenses: defaultNum(),
    payrollExpenses: defaultNum(),
    administrativeExpenses: defaultNum(),
    marketingExpenses: defaultNum(),
    depreciationAmortization: defaultNum(),
    otherExpenses: defaultNum(),
    notes: defaultStr(),
  });
  const [assets, setAssets] = useState<GaapAssets>({
    currentAssets: defaultNum(),
    fixedAssets: defaultNum(),
    intangibleAssets: defaultNum(),
    accumulatedDepreciation: defaultNum(),
    notes: defaultStr(),
  });
  const [liabilities, setLiabilities] = useState<GaapLiabilities>({
    currentLiabilities: defaultNum(),
    longTermLiabilities: defaultNum(),
    accountsPayable: defaultNum(),
    notesPayable: defaultNum(),
    otherLiabilities: defaultNum(),
    notes: defaultStr(),
  });
  const [equity, setEquity] = useState<GaapEquity>({
    ownersEquity: defaultNum(),
    retainedEarnings: defaultNum(),
    capitalContributions: defaultNum(),
    withdrawals: defaultNum(),
    notes: defaultStr(),
  });
  const [compliance, setCompliance] = useState<GaapComplianceChecklist>({
    revenueRecognitionAsc606: false,
    expenseMatchingPrinciple: false,
    fullDisclosurePrinciple: false,
    materialityPrinciple: false,
    consistencyPrinciple: false,
    conservatismPrinciple: false,
  });
  const [finalization, setFinalization] = useState<GaapFinalization>({
    preparedBy: 'Admin',
    reviewedBy: defaultStr(),
    approvalStatus: 'Pending',
    notes: defaultStr(),
  });

  const period = useMemo<GaapReportingPeriod>(
    () => getPeriodForMonthYear(month, year),
    [month, year]
  );

  useEffect(() => {
    setClient(getGaapClientMock());
  }, []);

  const generate = useCallback(() => {
    return saveGaapReport({
      client,
      period,
      revenue,
      expenses,
      assets,
      liabilities,
      equity,
      compliance,
      finalization,
    });
  }, [client, period, revenue, expenses, assets, liabilities, equity, compliance, finalization]);

  return {
    client,
    setClient,
    month,
    setMonth,
    year,
    setYear,
    years,
    period,
    revenue,
    setRevenue,
    expenses,
    setExpenses,
    assets,
    setAssets,
    liabilities,
    setLiabilities,
    equity,
    setEquity,
    compliance,
    setCompliance,
    finalization,
    setFinalization,
    generate,
  };
}

export function GaapForm() {
  const f = useGaapForm();
  const [loading, setLoading] = useState(false);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      f.generate();
      window.location.href = '/admin/gaap/reports';
    } finally {
      setLoading(false);
    }
  };

  const num = (v: string) => (v === '' || v == null ? 0 : Number(v));
  const updateRevenue = (k: keyof GaapRevenue, v: string | number) => {
    if (k === 'notes') f.setRevenue((r) => ({ ...r, notes: v as string }));
    else f.setRevenue((r) => ({ ...r, [k]: typeof v === 'number' ? v : num(v as string) }));
  };
  const updateExpenses = (k: keyof GaapExpenses, v: string | number) => {
    if (k === 'notes') f.setExpenses((e) => ({ ...e, notes: v as string }));
    else f.setExpenses((e) => ({ ...e, [k]: typeof v === 'number' ? v : num(v as string) }));
  };
  const updateAssets = (k: keyof GaapAssets, v: string | number) => {
    if (k === 'notes') f.setAssets((a) => ({ ...a, notes: v as string }));
    else f.setAssets((a) => ({ ...a, [k]: typeof v === 'number' ? v : num(v as string) }));
  };
  const updateLiabilities = (k: keyof GaapLiabilities, v: string | number) => {
    if (k === 'notes') f.setLiabilities((l) => ({ ...l, notes: v as string }));
    else f.setLiabilities((l) => ({ ...l, [k]: typeof v === 'number' ? v : num(v as string) }));
  };
  const updateEquity = (k: keyof GaapEquity, v: string | number) => {
    if (k === 'notes') f.setEquity((e) => ({ ...e, notes: v as string }));
    else f.setEquity((e) => ({ ...e, [k]: typeof v === 'number' ? v : num(v as string) }));
  };
  const updateCompliance = (k: keyof GaapComplianceChecklist, v: boolean) =>
    f.setCompliance((c) => ({ ...c, [k]: v }));
  const updateFinalization = (k: keyof GaapFinalization, v: string | ApprovalStatus) =>
    f.setFinalization((x) => ({ ...x, [k]: v }));

  return (
    <form onSubmit={handleGenerate} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">1. CLIENT INFORMATION</CardTitle>
          <p className="text-sm text-secondary-500">Auto-filled from system</p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Input label="Client Name" value={f.client.clientName} onChange={(e) => f.setClient((c) => ({ ...c, clientName: e.target.value }))} disabled={loading} />
          <Input label="Business Name (if applicable)" value={f.client.businessName} onChange={(e) => f.setClient((c) => ({ ...c, businessName: e.target.value }))} disabled={loading} />
          <Input label="EIN or SSN" value={f.client.einOrSsn} onChange={(e) => f.setClient((c) => ({ ...c, einOrSsn: e.target.value }))} disabled={loading} />
          <div className="sm:col-span-2">
            <Input label="Address" value={f.client.address} onChange={(e) => f.setClient((c) => ({ ...c, address: e.target.value }))} disabled={loading} />
          </div>
          <Input label="Country" value={f.client.country} onChange={(e) => f.setClient((c) => ({ ...c, country: e.target.value }))} disabled={loading} />
          <Input label="Email" type="email" value={f.client.email} onChange={(e) => f.setClient((c) => ({ ...c, email: e.target.value }))} disabled={loading} />
          <Input label="Phone" value={f.client.phone} onChange={(e) => f.setClient((c) => ({ ...c, phone: e.target.value }))} disabled={loading} />
          <Input label="Account Creation Date" value={f.client.accountCreationDate} disabled />
          <Input label="Last Update Date" value={f.client.lastUpdateDate} disabled />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">2. REPORTING PERIOD</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-secondary-700">Reporting Month</label>
            <select
              value={f.month}
              onChange={(e) => f.setMonth(Number(e.target.value) as ReportingMonth)}
              className="h-11 w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:ring-2 focus:ring-primary-500"
              disabled={loading}
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-secondary-700">Reporting Year</label>
            <select
              value={f.year}
              onChange={(e) => f.setYear(Number(e.target.value))}
              className="h-11 w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:ring-2 focus:ring-primary-500"
              disabled={loading}
            >
              {f.years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <Input label="Period Start Date" value={f.period.periodStart} disabled />
          <Input label="Period End Date" value={f.period.periodEnd} disabled />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">3. REVENUE</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Input label="Gross Revenue" type="number" step="0.01" value={f.revenue.grossRevenue || ''} onChange={(e) => updateRevenue('grossRevenue', e.target.value)} disabled={loading} />
          <Input label="Adjusted Revenue" type="number" step="0.01" value={f.revenue.adjustedRevenue || ''} onChange={(e) => updateRevenue('adjustedRevenue', e.target.value)} disabled={loading} />
          <Input label="Deferred Revenue" type="number" step="0.01" value={f.revenue.deferredRevenue || ''} onChange={(e) => updateRevenue('deferredRevenue', e.target.value)} disabled={loading} />
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium text-secondary-700">Notes</label>
            <textarea value={f.revenue.notes} onChange={(e) => updateRevenue('notes', e.target.value)} rows={2} className="w-full rounded-lg border border-secondary-300 px-4 py-2 text-sm" disabled={loading} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">4. EXPENSES</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Input label="Operating Expenses" type="number" step="0.01" value={f.expenses.operatingExpenses || ''} onChange={(e) => updateExpenses('operatingExpenses', e.target.value)} disabled={loading} />
          <Input label="Payroll Expenses" type="number" step="0.01" value={f.expenses.payrollExpenses || ''} onChange={(e) => updateExpenses('payrollExpenses', e.target.value)} disabled={loading} />
          <Input label="Administrative Expenses" type="number" step="0.01" value={f.expenses.administrativeExpenses || ''} onChange={(e) => updateExpenses('administrativeExpenses', e.target.value)} disabled={loading} />
          <Input label="Marketing Expenses" type="number" step="0.01" value={f.expenses.marketingExpenses || ''} onChange={(e) => updateExpenses('marketingExpenses', e.target.value)} disabled={loading} />
          <Input label="Depreciation & Amortization" type="number" step="0.01" value={f.expenses.depreciationAmortization || ''} onChange={(e) => updateExpenses('depreciationAmortization', e.target.value)} disabled={loading} />
          <Input label="Other Expenses" type="number" step="0.01" value={f.expenses.otherExpenses || ''} onChange={(e) => updateExpenses('otherExpenses', e.target.value)} disabled={loading} />
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium text-secondary-700">Notes</label>
            <textarea value={f.expenses.notes} onChange={(e) => updateExpenses('notes', e.target.value)} rows={2} className="w-full rounded-lg border border-secondary-300 px-4 py-2 text-sm" disabled={loading} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">5. ASSETS</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Input label="Current Assets" type="number" step="0.01" value={f.assets.currentAssets || ''} onChange={(e) => updateAssets('currentAssets', e.target.value)} disabled={loading} />
          <Input label="Fixed Assets" type="number" step="0.01" value={f.assets.fixedAssets || ''} onChange={(e) => updateAssets('fixedAssets', e.target.value)} disabled={loading} />
          <Input label="Intangible Assets" type="number" step="0.01" value={f.assets.intangibleAssets || ''} onChange={(e) => updateAssets('intangibleAssets', e.target.value)} disabled={loading} />
          <Input label="Accumulated Depreciation" type="number" step="0.01" value={f.assets.accumulatedDepreciation || ''} onChange={(e) => updateAssets('accumulatedDepreciation', e.target.value)} disabled={loading} />
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium text-secondary-700">Notes</label>
            <textarea value={f.assets.notes} onChange={(e) => updateAssets('notes', e.target.value)} rows={2} className="w-full rounded-lg border border-secondary-300 px-4 py-2 text-sm" disabled={loading} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">6. LIABILITIES</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Input label="Current Liabilities" type="number" step="0.01" value={f.liabilities.currentLiabilities || ''} onChange={(e) => updateLiabilities('currentLiabilities', e.target.value)} disabled={loading} />
          <Input label="Long-term Liabilities" type="number" step="0.01" value={f.liabilities.longTermLiabilities || ''} onChange={(e) => updateLiabilities('longTermLiabilities', e.target.value)} disabled={loading} />
          <Input label="Accounts Payable" type="number" step="0.01" value={f.liabilities.accountsPayable || ''} onChange={(e) => updateLiabilities('accountsPayable', e.target.value)} disabled={loading} />
          <Input label="Notes Payable" type="number" step="0.01" value={f.liabilities.notesPayable || ''} onChange={(e) => updateLiabilities('notesPayable', e.target.value)} disabled={loading} />
          <Input label="Other Liabilities" type="number" step="0.01" value={f.liabilities.otherLiabilities || ''} onChange={(e) => updateLiabilities('otherLiabilities', e.target.value)} disabled={loading} />
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium text-secondary-700">Notes</label>
            <textarea value={f.liabilities.notes} onChange={(e) => updateLiabilities('notes', e.target.value)} rows={2} className="w-full rounded-lg border border-secondary-300 px-4 py-2 text-sm" disabled={loading} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">7. EQUITY</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Input label="Owner's Equity" type="number" step="0.01" value={f.equity.ownersEquity || ''} onChange={(e) => updateEquity('ownersEquity', e.target.value)} disabled={loading} />
          <Input label="Retained Earnings" type="number" step="0.01" value={f.equity.retainedEarnings || ''} onChange={(e) => updateEquity('retainedEarnings', e.target.value)} disabled={loading} />
          <Input label="Capital Contributions" type="number" step="0.01" value={f.equity.capitalContributions || ''} onChange={(e) => updateEquity('capitalContributions', e.target.value)} disabled={loading} />
          <Input label="Withdrawals" type="number" step="0.01" value={f.equity.withdrawals || ''} onChange={(e) => updateEquity('withdrawals', e.target.value)} disabled={loading} />
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium text-secondary-700">Notes</label>
            <textarea value={f.equity.notes} onChange={(e) => updateEquity('notes', e.target.value)} rows={2} className="w-full rounded-lg border border-secondary-300 px-4 py-2 text-sm" disabled={loading} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">8. GAAP COMPLIANCE CHECKLIST</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: 'revenueRecognitionAsc606' as const, label: 'Revenue Recognition (ASC 606)' },
            { key: 'expenseMatchingPrinciple' as const, label: 'Expense Matching Principle' },
            { key: 'fullDisclosurePrinciple' as const, label: 'Full Disclosure Principle' },
            { key: 'materialityPrinciple' as const, label: 'Materiality Principle' },
            { key: 'consistencyPrinciple' as const, label: 'Consistency Principle' },
            { key: 'conservatismPrinciple' as const, label: 'Conservatism Principle' },
          ].map(({ key, label }) => (
            <label key={key} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={f.compliance[key]}
                onChange={(e) => updateCompliance(key, e.target.checked)}
                disabled={loading}
                className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-secondary-900">{label}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">9. FINALIZATION</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Input label="Prepared By" value={f.finalization.preparedBy} onChange={(e) => updateFinalization('preparedBy', e.target.value)} disabled={loading} />
          <Input label="Reviewed By" value={f.finalization.reviewedBy} onChange={(e) => updateFinalization('reviewedBy', e.target.value)} disabled={loading} />
          <div>
            <label className="mb-2 block text-sm font-medium text-secondary-700">Approval Status</label>
            <select
              value={f.finalization.approvalStatus}
              onChange={(e) => updateFinalization('approvalStatus', e.target.value as ApprovalStatus)}
              className="h-11 w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:ring-2 focus:ring-primary-500"
              disabled={loading}
            >
              {APPROVAL_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium text-secondary-700">Notes</label>
            <textarea value={f.finalization.notes} onChange={(e) => updateFinalization('notes', e.target.value)} rows={2} className="w-full rounded-lg border border-secondary-300 px-4 py-2 text-sm" disabled={loading} />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={loading}>
          Generate Monthly GAAP Report
        </Button>
      </div>
    </form>
  );
}
