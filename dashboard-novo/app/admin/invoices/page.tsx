'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/language-context';
import { seedMockInvoices } from '@/services/invoices/invoices.service';
import { InvoicesListTable } from '@/components/invoices/invoices-list-table';

export default function InvoicesListPage() {
  const { t } = useLanguage();

  useEffect(() => {
    seedMockInvoices();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-secondary-900">{t('inv.title')}</h1>
        <Link href="/admin/invoices/new">
          <Button size="lg" className="shadow-lg">
            {t('inv.createNew')}
          </Button>
        </Link>
      </div>
      <InvoicesListTable />
    </div>
  );
}
