'use client';

import { PaymentsForm } from '@/components/payments/payments-form';
import { useLanguage } from '@/contexts/language-context';

export default function PaymentsPage() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">{t('payments.title')}</h1>
        <p className="mt-1 text-sm text-secondary-600">{t('payments.subtitle')}</p>
      </div>
      <PaymentsForm />
    </div>
  );
}
