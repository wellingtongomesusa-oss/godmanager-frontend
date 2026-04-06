'use client';

import { AutomationDashboard } from '@/components/automation/automation-dashboard';
import { useLanguage } from '@/contexts/language-context';

export default function AutomationPage() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">{t('automation.title')}</h1>
        <p className="mt-1 text-sm text-secondary-600">{t('automation.subtitle')}</p>
      </div>
      <AutomationDashboard />
    </div>
  );
}
