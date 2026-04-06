'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/language-context';
import { GaapForm } from '@/components/gaap/gaap-form';

export default function GaapPage() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">{t('gaap.title')}</h1>
          <p className="mt-1 text-sm text-secondary-600">{t('gaap.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/gaap/reports">
            <Button variant="outline">{t('gaap.reports')}</Button>
          </Link>
        </div>
      </div>

      <GaapForm />
    </div>
  );
}
