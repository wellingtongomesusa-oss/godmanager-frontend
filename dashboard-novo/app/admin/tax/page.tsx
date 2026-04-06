'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useLanguage } from '@/contexts/language-context';
import type { TranslationKey } from '@/lib/i18n/translations';
import { TaxpayerProfileForm } from '@/components/tax/taxpayer-profile-form';
import {
  getFederalTaxStatus,
  getFilings,
  getPaymentHistory,
  getNotices,
  syncIrsData,
  type FilingItem,
  type IrsPaymentItem,
  type IrsNoticeItem,
} from '@/services/irs-status.service';
import { validateTaxId, type TaxIdType } from '@/services/tax-validation.service';
import { getTaxReportData } from '@/services/irs-report.service';
import { exportTaxReportPdf, exportTaxReportCsv } from '@/lib/tax-export';

const currentYear = new Date().getFullYear();
const STATUS_KEYS: Record<string, string> = {
  Filed: 'tax.statusFiled',
  Pending: 'tax.statusPending',
  Overdue: 'tax.statusOverdue',
  Extension: 'tax.statusExtension',
};

export default function TaxPage() {
  const { t } = useLanguage();
  const [syncing, setSyncing] = useState(false);
  const [validateModalOpen, setValidateModalOpen] = useState(false);
  const [validateIdType, setValidateIdType] = useState<TaxIdType>('EIN');
  const [validateValue, setValidateValue] = useState('');
  const [validateResult, setValidateResult] = useState<{ valid: boolean; message: string; formatted?: string } | null>(null);
  const [taxYear, setTaxYear] = useState(currentYear);
  const [taxpayerId, setTaxpayerId] = useState('XX-XXXXXXX');

  const [filings, setFilings] = useState<FilingItem[]>([]);
  const [payments, setPayments] = useState<IrsPaymentItem[]>([]);
  const [notices, setNotices] = useState<IrsNoticeItem[]>([]);
  const [federalStatus, setFederalStatus] = useState<ReturnType<typeof getFederalTaxStatus> | null>(null);

  const loadData = useCallback(() => {
    setFilings(getFilings(taxYear));
    setPayments(getPaymentHistory(taxYear));
    setNotices(getNotices());
    setFederalStatus(getFederalTaxStatus(taxpayerId, taxYear));
  }, [taxYear, taxpayerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncIrsData(taxpayerId);
      loadData();
    } finally {
      setSyncing(false);
    }
  }, [taxpayerId, loadData]);

  const handleValidate = useCallback(() => {
    const result = validateTaxId({ idType: validateIdType, value: validateValue });
    setValidateResult({ valid: result.valid, message: result.message, formatted: result.formatted });
  }, [validateIdType, validateValue]);

  const handleDownloadSummary = useCallback(() => {
    exportTaxReportPdf(taxYear);
  }, [taxYear]);

  const handleExportCsv = useCallback(() => {
    exportTaxReportCsv(taxYear);
  }, [taxYear]);

  const reportData = getTaxReportData({ taxYear, taxpayerId });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-secondary-200 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-secondary-900 sm:text-3xl">{t('tax.title')}</h1>
        <p className="mt-2 text-sm text-secondary-600 sm:text-base">{t('tax.subtitle')}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={handleSync} disabled={syncing} variant="outline" size="sm">
            {syncing ? t('common.loading') : t('tax.syncIrs')}
          </Button>
          <Button onClick={() => setValidateModalOpen(true)} variant="outline" size="sm">
            {t('tax.validateTaxpayer')}
          </Button>
          <Button onClick={handleDownloadSummary} size="sm">
            {t('tax.generateReport')}
          </Button>
          <Button onClick={handleDownloadSummary} variant="outline" size="sm">
            {t('tax.downloadSummary')}
          </Button>
          <Button onClick={handleExportCsv} variant="ghost" size="sm">
            {t('tax.exportCsv')}
          </Button>
        </div>
      </div>

      {/* Taxpayer Profile Form */}
      <TaxpayerProfileForm />

      {/* Taxpayer Information summary + Federal Tax Status + EIN/SSN */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card variant="elevated" className="bg-white">
          <CardHeader>
            <CardTitle className="text-lg text-secondary-900">{t('tax.sectionTaxpayer')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-secondary-600">ID: {taxpayerId} · {t('tax.taxYear')}: {taxYear}</p>
            <p className="mt-2 text-xs text-secondary-500">Update in Taxpayer Profile above.</p>
          </CardContent>
        </Card>
        <Card variant="elevated" className="bg-white">
          <CardHeader>
            <CardTitle className="text-lg text-secondary-900">{t('tax.sectionFederalStatus')}</CardTitle>
          </CardHeader>
          <CardContent>
            {federalStatus && (
              <ul className="space-y-2 text-sm text-secondary-700">
                <li><span className="font-medium">{t('tax.statusPending')}:</span> {t((STATUS_KEYS[federalStatus.filingStatus] ?? 'tax.statusPending') as TranslationKey)}</li>
                <li><span className="font-medium">{t('tax.estimatedPayments')}:</span> ${federalStatus.estimatedPayments.toLocaleString()}</li>
                <li><span className="font-medium">{t('tax.obligationsPending')}:</span> ${federalStatus.balanceDue.toLocaleString()}</li>
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* EIN/SSN Validation inline hint */}
      <Card className="border-secondary-200 bg-white">
        <CardHeader>
          <CardTitle className="text-lg text-secondary-900">{t('tax.sectionEinSsn')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-secondary-600">Use &quot;{t('tax.validateTaxpayer')}&quot; above to validate EIN, SSN, or ITIN format.</p>
        </CardContent>
      </Card>

      {/* Filing Requirements + Estimated Taxes */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card variant="elevated" className="bg-white">
          <CardHeader>
            <CardTitle className="text-lg text-secondary-900">{t('tax.sectionFilingReq')}</CardTitle>
          </CardHeader>
          <CardContent>
            {filings.length === 0 ? (
              <p className="text-sm text-secondary-500">{t('tax.noFilings')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-secondary-200 text-left text-secondary-600">
                      <th className="pb-2 pr-4 font-medium">{t('tax.formType')}</th>
                      <th className="pb-2 pr-4 font-medium">{t('tax.dueDate')}</th>
                      <th className="pb-2 font-medium">{t('table.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filings.map((f) => (
                      <tr key={f.id} className="border-b border-secondary-100">
                        <td className="py-2 pr-4">{f.formType}</td>
                        <td className="py-2 pr-4">{f.dueDate}</td>
                        <td className="py-2">{t((STATUS_KEYS[f.status] ?? 'tax.statusPending') as TranslationKey)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        <Card variant="elevated" className="bg-white">
          <CardHeader>
            <CardTitle className="text-lg text-secondary-900">{t('tax.sectionEstimated')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-secondary-700">
              <p><span className="font-medium">{t('tax.annualIncome')}:</span> ${reportData.annualIncome.toLocaleString()}</p>
              <p><span className="font-medium">{t('tax.deductibleExpenses')}:</span> ${reportData.deductibleExpenses.toLocaleString()}</p>
              <p><span className="font-medium">{t('tax.projectedTaxDue')}:</span> ${reportData.projectedTaxDue.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* IRS Notices & Alerts */}
      <Card variant="elevated" className="bg-white">
        <CardHeader>
          <CardTitle className="text-lg text-secondary-900">{t('tax.sectionNotices')}</CardTitle>
        </CardHeader>
        <CardContent>
          {notices.length === 0 ? (
            <p className="text-sm text-secondary-500">{t('tax.noNotices')}</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {notices.map((n) => (
                <li key={n.id} className="flex items-start justify-between rounded-lg border border-secondary-200 p-3">
                  <div>
                    <span className="font-medium text-secondary-800">{n.noticeType}</span> · {n.description}
                    {n.amount != null && n.amount > 0 && <span className="ml-2">${n.amount.toLocaleString()}</span>}
                  </div>
                  <span className={n.resolved ? 'text-success-600' : 'text-accent-600'}>{n.resolved ? t('tax.resolved') : t('tax.unresolved')}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Payment History (IRS) */}
      <Card variant="elevated" className="bg-white">
        <CardHeader>
          <CardTitle className="text-lg text-secondary-900">{t('tax.sectionPaymentHistory')}</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-secondary-500">{t('tax.noPayments')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-secondary-200 text-left text-secondary-600">
                    <th className="pb-2 pr-4 font-medium">{t('tax.date')}</th>
                    <th className="pb-2 pr-4 font-medium">{t('tax.type')}</th>
                    <th className="pb-2 font-medium">{t('tax.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-secondary-100">
                      <td className="py-2 pr-4">{p.date}</td>
                      <td className="py-2 pr-4">{p.type}</td>
                      <td className="py-2">${p.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tax Documents */}
      <Card className="border-secondary-200 bg-white">
        <CardHeader>
          <CardTitle className="text-lg text-secondary-900">{t('tax.sectionDocuments')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-secondary-600">Upload W‑2, 1099, 1040, Schedule C and other documents in the Taxpayer Profile form above.</p>
        </CardContent>
      </Card>

      {/* Validate Taxpayer Modal */}
      <Modal open={validateModalOpen} onClose={() => { setValidateModalOpen(false); setValidateResult(null); setValidateValue(''); }} title={t('tax.validateTaxpayer')} size="md">
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-secondary-700">ID Type</label>
            <select
              value={validateIdType}
              onChange={(e) => setValidateIdType(e.target.value as TaxIdType)}
              className="flex h-11 w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="EIN">EIN</option>
              <option value="SSN">SSN</option>
              <option value="ITIN">ITIN</option>
            </select>
          </div>
          <Input label={validateIdType === 'EIN' ? 'EIN (XX-XXXXXXX)' : validateIdType === 'SSN' ? 'SSN (XXX-XX-XXXX)' : 'ITIN (9XX-XX-XXXX)'} value={validateValue} onChange={(e) => setValidateValue(e.target.value)} placeholder={validateIdType === 'EIN' ? '12-3456789' : validateIdType === 'SSN' ? '123-45-6789' : '9XX-XX-XXXX'} />
          <Button onClick={handleValidate}>{t('tax.validate')}</Button>
          {validateResult && (
            <div className={`rounded-lg border p-3 text-sm ${validateResult.valid ? 'border-success-200 bg-success-50 text-success-800' : 'border-danger-200 bg-danger-50 text-danger-800'}`}>
              {validateResult.formatted && <p className="font-medium">{validateResult.formatted}</p>}
              <p>{validateResult.message}</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
