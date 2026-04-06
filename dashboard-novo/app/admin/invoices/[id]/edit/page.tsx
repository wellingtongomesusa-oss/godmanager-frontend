'use client';

import React, { useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/language-context';
import { getInvoiceById } from '@/services/invoices/invoices.service';
import { InvoiceForm } from '@/components/invoices/invoice-form';

export default function EditInvoicePage() {
  const params = useParams();
  const { t } = useLanguage();
  const id = typeof params?.id === 'string' ? params.id : '';

  const invoice = useMemo(() => getInvoiceById(id), [id]);

  if (!invoice) {
    return (
      <div className="space-y-6">
        <p className="text-secondary-600">{t('inv.empty')}</p>
        <Link href="/admin/invoices">
          <Button variant="outline">← {t('inv.title')}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-secondary-900">
        {t('inv.edit')} · {invoice.number}
      </h1>
      <InvoiceForm invoice={invoice} />
    </div>
  );
}
