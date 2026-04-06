'use client';

import React, { useCallback, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/language-context';

export type FilingStatusOption = 'Individual' | 'LLC' | 'S-Corp' | 'C-Corp';

export interface TaxpayerProfileData {
  fullName: string;
  businessName: string;
  einSsnItin: string;
  filingStatus: FilingStatusOption;
  address: string;
  email: string;
  phone: string;
  taxYear: number;
  filingType: string;
  estimatedPayments: number;
  priorYearLiability: number;
  notes: string;
}

const defaultProfile: TaxpayerProfileData = {
  fullName: '',
  businessName: '',
  einSsnItin: '',
  filingStatus: 'Individual',
  address: '',
  email: '',
  phone: '',
  taxYear: new Date().getFullYear(),
  filingType: '1040',
  estimatedPayments: 0,
  priorYearLiability: 0,
  notes: '',
};

const FILING_STATUS_KEYS: Record<FilingStatusOption, 'tax.filingStatus.individual' | 'tax.filingStatus.llc' | 'tax.filingStatus.scorp' | 'tax.filingStatus.ccorp'> = {
  Individual: 'tax.filingStatus.individual',
  LLC: 'tax.filingStatus.llc',
  'S-Corp': 'tax.filingStatus.scorp',
  'C-Corp': 'tax.filingStatus.ccorp',
};

export function TaxpayerProfileForm() {
  const { t } = useLanguage();
  const [profile, setProfile] = useState<TaxpayerProfileData>(defaultProfile);
  const [uploadW2, setUploadW2] = useState<File | null>(null);
  const [upload1099, setUpload1099] = useState<File | null>(null);
  const [uploadReceipts, setUploadReceipts] = useState<File | null>(null);
  const [uploadBank, setUploadBank] = useState<File | null>(null);

  const update = useCallback(<K extends keyof TaxpayerProfileData>(key: K, value: TaxpayerProfileData[K]) => {
    setProfile((p) => ({ ...p, [key]: value }));
  }, []);

  const handleFile = useCallback(
    (key: 'W2' | '1099' | 'Receipts' | 'Bank', file: File | null) => {
      if (key === 'W2') setUploadW2(file);
      if (key === '1099') setUpload1099(file);
      if (key === 'Receipts') setUploadReceipts(file);
      if (key === 'Bank') setUploadBank(file);
    },
    []
  );

  return (
    <Card variant="elevated" className="bg-white">
      <CardHeader>
        <CardTitle className="text-xl text-secondary-900">{t('tax.profile')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Section 1 — Identification */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-secondary-600">{t('tax.profileSection1')}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t('tax.fullName')} value={profile.fullName} onChange={(e) => update('fullName', e.target.value)} placeholder="John Doe" />
            <Input label={t('tax.businessName')} value={profile.businessName} onChange={(e) => update('businessName', e.target.value)} placeholder="Acme Inc." />
            <Input label={t('tax.einSsnItin')} value={profile.einSsnItin} onChange={(e) => update('einSsnItin', e.target.value)} placeholder="XX-XXXXXXX" className="sm:col-span-2" />
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-secondary-700">{t('tax.filingStatus')}</label>
              <select
                value={profile.filingStatus}
                onChange={(e) => update('filingStatus', e.target.value as FilingStatusOption)}
                className="flex h-11 w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {(Object.keys(FILING_STATUS_KEYS) as FilingStatusOption[]).map((opt) => (
                  <option key={opt} value={opt}>
                    {t(FILING_STATUS_KEYS[opt])}
                  </option>
                ))}
              </select>
            </div>
            <Input label={t('tax.address')} value={profile.address} onChange={(e) => update('address', e.target.value)} placeholder="123 Main St, City, ST ZIP" className="sm:col-span-2" />
            <Input label={t('tax.email')} type="email" value={profile.email} onChange={(e) => update('email', e.target.value)} placeholder="john@example.com" />
            <Input label={t('tax.phone')} type="tel" value={profile.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+1 (555) 000-0000" />
          </div>
        </div>

        {/* Section 2 — Tax Information */}
        <div className="space-y-4 border-t border-secondary-200 pt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-secondary-600">{t('tax.profileSection2')}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t('tax.taxYear')} type="number" value={profile.taxYear || ''} onChange={(e) => update('taxYear', e.target.value ? parseInt(e.target.value, 10) : 0)} placeholder="2025" />
            <Input label={t('tax.filingType')} value={profile.filingType} onChange={(e) => update('filingType', e.target.value)} placeholder="1040, 1120" />
            <Input label={t('tax.estimatedPayments')} type="number" value={profile.estimatedPayments || ''} onChange={(e) => update('estimatedPayments', e.target.value ? parseFloat(e.target.value) : 0)} placeholder="0" />
            <Input label={t('tax.priorYearLiability')} type="number" value={profile.priorYearLiability || ''} onChange={(e) => update('priorYearLiability', e.target.value ? parseFloat(e.target.value) : 0)} placeholder="0" />
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-secondary-700">{t('tax.notes')}</label>
              <textarea
                value={profile.notes}
                onChange={(e) => update('notes', e.target.value)}
                placeholder="Notes..."
                rows={3}
                className="flex w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 placeholder:text-secondary-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3 — Document Upload */}
        <div className="space-y-4 border-t border-secondary-200 pt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-secondary-600">{t('tax.profileSection3')}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-secondary-700">{t('tax.uploadW2')}</label>
              <input type="file" accept=".pdf,.jpg,.png" className="text-sm text-secondary-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-700" onChange={(e) => handleFile('W2', e.target.files?.[0] ?? null)} />
              {uploadW2 && <p className="mt-1 text-xs text-secondary-500">{uploadW2.name}</p>}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-secondary-700">{t('tax.upload1099')}</label>
              <input type="file" accept=".pdf,.jpg,.png" className="text-sm text-secondary-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-700" onChange={(e) => handleFile('1099', e.target.files?.[0] ?? null)} />
              {upload1099 && <p className="mt-1 text-xs text-secondary-500">{upload1099.name}</p>}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-secondary-700">{t('tax.uploadReceipts')}</label>
              <input type="file" accept=".pdf,.jpg,.png" multiple className="text-sm text-secondary-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-700" onChange={(e) => handleFile('Receipts', e.target.files?.[0] ?? null)} />
              {uploadReceipts && <p className="mt-1 text-xs text-secondary-500">{uploadReceipts.name}</p>}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-secondary-700">{t('tax.uploadBankStatements')}</label>
              <input type="file" accept=".pdf,.csv" className="text-sm text-secondary-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-700" onChange={(e) => handleFile('Bank', e.target.files?.[0] ?? null)} />
              {uploadBank && <p className="mt-1 text-xs text-secondary-500">{uploadBank.name}</p>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
