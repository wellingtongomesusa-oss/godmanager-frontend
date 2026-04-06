'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/language-context';
import { formatCurrency } from '@/lib/utils';
import { downloadCsv } from '@/lib/csv-export';
import { download1099Pdf } from '@/lib/1099-export';
import {
  list1099Recipients,
  add1099Recipient,
  remove1099Recipient,
  get1099ExportData,
  type Recipient1099,
  type Form1099Type,
} from '@/services/1099.service';

const FORM_TYPES: { value: Form1099Type; labelKey: string }[] = [
  { value: '1099-NEC', labelKey: '1099.type.nec' },
  { value: '1099-MISC', labelKey: '1099.type.misc' },
  { value: '1099-INT', labelKey: '1099.type.int' },
];

const currentYear = new Date().getFullYear();

export default function Form1099Page() {
  const { t } = useLanguage();
  const [formType, setFormType] = useState<Form1099Type>('1099-NEC');
  const [taxYear, setTaxYear] = useState(currentYear);
  const [name, setName] = useState('');
  const [tin, setTin] = useState('');
  const [amount, setAmount] = useState('');
  const [recipients, setRecipients] = useState<Recipient1099[]>([]);
  const [filterYear, setFilterYear] = useState<number | ''>(currentYear);

  const refresh = useCallback(() => {
    const list = list1099Recipients({
      taxYear: filterYear === '' ? undefined : filterYear,
    });
    setRecipients(list);
  }, [filterYear]);

  const loadRecipients = useCallback(() => {
    const list = list1099Recipients({
      taxYear: filterYear === '' ? undefined : filterYear,
    });
    setRecipients(list);
  }, [filterYear]);

  useEffect(() => {
    loadRecipients();
  }, [loadRecipients]);

  const handleAdd = useCallback(() => {
    const amt = parseFloat(amount.replace(/,/g, '.').trim());
    if (!name.trim() || !tin.trim() || isNaN(amt) || amt < 0) return;
    add1099Recipient({
      name: name.trim(),
      tin: tin.trim(),
      amount: amt,
      formType,
      taxYear,
    });
    setName('');
    setTin('');
    setAmount('');
    loadRecipients();
  }, [name, tin, amount, formType, taxYear, loadRecipients]);

  const handleRemove = useCallback(
    (id: string) => {
      remove1099Recipient(id);
      loadRecipients();
    },
    [loadRecipients]
  );

  const exportYear = filterYear === '' ? undefined : filterYear;
  const exportFilename = filterYear === '' ? '1099-all' : `1099-${filterYear}`;

  const handleExportCsv = useCallback(() => {
    const data = get1099ExportData({ taxYear: exportYear });
    if (data.length === 0) return;
    downloadCsv(
      data as Record<string, string | number | null | undefined>[],
      `${exportFilename}.csv`
    );
  }, [exportYear, exportFilename]);

  const handleGenerate = useCallback(() => {
    const data = get1099ExportData({ taxYear: exportYear });
    if (data.length === 0) return;
    downloadCsv(
      data as Record<string, string | number | null | undefined>[],
      `${exportFilename}-${formType}.csv`
    );
  }, [formType, exportYear, exportFilename]);

  const handleExportPdf = useCallback(() => {
    const data = get1099ExportData({ taxYear: exportYear });
    if (data.length === 0) return;
    download1099Pdf({ taxYear: exportYear }, `${exportFilename}.pdf`);
  }, [exportYear, exportFilename]);

  return (
    <div className="space-y-8">
      <div className="border-b border-secondary-200 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-secondary-900 sm:text-3xl">{t('1099.title')}</h1>
        <p className="mt-2 text-sm text-secondary-600 sm:text-base">{t('1099.subtitle')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card variant="outlined" className="bg-white">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-secondary-900">{t('1099.formType')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-secondary-700">{t('1099.formType')}</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as Form1099Type)}
                className="h-11 w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {FORM_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey as '1099.type.nec')}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label={t('1099.taxYear')}
              type="number"
              min={currentYear - 5}
              max={currentYear + 1}
              value={String(taxYear)}
              onChange={(e) => setTaxYear(parseInt(e.target.value, 10) || currentYear)}
            />
          </CardContent>
        </Card>

        <Card variant="outlined" className="bg-white">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-secondary-900">{t('1099.addRecipient')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label={t('1099.recipientName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe / Acme Inc."
            />
            <Input
              label={t('1099.tin')}
              value={tin}
              onChange={(e) => setTin(e.target.value)}
              placeholder="12-3456789"
            />
            <Input
              label={t('1099.amount')}
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
            <Button onClick={handleAdd} disabled={!name.trim() || !tin.trim() || !amount.trim()}>
              {t('1099.addRecipient')}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card variant="outlined" className="bg-white">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 pb-4">
          <div>
            <CardTitle className="text-lg text-secondary-900">{t('1099.recipients')}</CardTitle>
            <p className="mt-1 text-sm text-secondary-500">
              {t('1099.taxYear')}:{' '}
              <select
                value={filterYear === '' ? 'all' : filterYear}
                onChange={(e) => setFilterYear(e.target.value === 'all' ? '' : parseInt(e.target.value, 10))}
                className="rounded-lg border border-secondary-300 bg-white px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">{t('1099.filterAll')}</option>
                {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={recipients.length === 0}>
              {t('1099.exportCsv')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={recipients.length === 0}>
              {t('1099.exportPdf')}
            </Button>
            <Button size="sm" onClick={handleGenerate} disabled={recipients.length === 0}>
              {t('1099.generate')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recipients.length === 0 ? (
            <p className="rounded-lg border border-dashed border-secondary-300 bg-secondary-50/50 py-12 text-center text-sm text-secondary-600">
              {t('1099.empty')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead>
                  <tr className="border-b border-secondary-200">
                    <th className="pb-3 pr-4 font-semibold text-secondary-800">{t('1099.recipientName')}</th>
                    <th className="pb-3 pr-4 font-semibold text-secondary-800">{t('1099.tin')}</th>
                    <th className="pb-3 pr-4 font-semibold text-secondary-800">{t('1099.amount')}</th>
                    <th className="pb-3 pr-4 font-semibold text-secondary-800">{t('1099.formType')}</th>
                    <th className="pb-3 font-semibold text-secondary-800">{t('1099.taxYear')}</th>
                    <th className="w-24 pb-3" />
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((r) => (
                    <tr key={r.id} className="border-b border-secondary-100">
                      <td className="py-3 pr-4 text-secondary-900">{r.name}</td>
                      <td className="py-3 pr-4 text-secondary-700">{r.tin}</td>
                      <td className="py-3 pr-4 font-medium text-secondary-900">{formatCurrency(r.amount, 'USD')}</td>
                      <td className="py-3 pr-4 text-secondary-600">{r.formType}</td>
                      <td className="py-3 pr-4 text-secondary-600">{r.taxYear}</td>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => handleRemove(r.id)}
                          className="rounded-lg px-3 py-1.5 text-sm font-medium text-danger-600 hover:bg-danger-50"
                        >
                          {t('1099.remove')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
