'use client';

import { useLanguage } from '@/contexts/language-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function InvoicePage() {
  const { t } = useLanguage();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">{t('sidebar.invoice')}</h1>
        <p className="mt-1 text-secondary-600">{t('common.comingSoon')}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('sidebar.invoice')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-secondary-600">{t('common.building')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
