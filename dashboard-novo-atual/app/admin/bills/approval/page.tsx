'use client';

import { BillsApprovalTable } from '@/components/bills/bills-approval-table';
import { useLanguage } from '@/contexts/language-context';

export default function BillsApprovalPage() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">{t('bills.approval')}</h1>
        <p className="mt-1 text-sm text-secondary-600">{t('bills.approvalDesc')}</p>
      </div>
      <BillsApprovalTable />
    </div>
  );
}
