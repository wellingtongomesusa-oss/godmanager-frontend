'use client';

import { ApReportPage } from '@/components/reports/ap/ap-report-page';
import { useLanguage } from '@/contexts/language-context';

export default function ReportsApPage() {
  const { t } = useLanguage();

  return (
    <div className="space-y-8">
      <div className="border-b border-secondary-200 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-secondary-900 sm:text-3xl">{t('reportsAp.title')}</h1>
        <p className="mt-2 text-sm text-secondary-600 sm:text-base">{t('reportsAp.subtitle')}</p>
      </div>
      <ApReportPage />
    </div>
  );
}
