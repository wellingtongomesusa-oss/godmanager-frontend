'use client';

import { useLanguage } from '@/contexts/language-context';
import { InvoiceForm } from '@/components/invoices/invoice-form';

export default function NewInvoicePage() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-secondary-900">{t('inv.new')}</h1>
      <InvoiceForm />
    </div>
  );
}
