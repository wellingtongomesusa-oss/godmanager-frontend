'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/language-context';
import { KpiCards } from '@/components/admin/kpi-cards';
import { TransactionsTable } from '@/components/admin/transactions-table';
import { AddDemandModal } from '@/components/admin/add-demand-modal';
import {
  getTransactions,
  setTransactionStatus,
  approveStep1,
  approveStep2,
  getMetrics,
  getDashboardKpis,
  type Transaction,
  type TransactionFilters,
  type TransactionStatus,
  type AdminMetrics,
} from '@/services/admin/admin-dashboard.service';
import type { Department } from '@/services/departments.service';

export default function DepartmentDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useLanguage();
  const id = params.id as string;
  const [department, setDepartment] = useState<Department | null>(null);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<AdminMetrics>({
    contasCadastradas: 0,
    transacoesTotais: 0,
    transacoesConcluidas: 0,
    transacoesPendentes: 0,
    transacoesCanceladas: 0,
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filters, setFilters] = useState<TransactionFilters>({});
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/departamentos/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          router.replace('/admin/painel');
          return;
        }
        setDepartment(data);
      })
      .catch(() => router.replace('/admin/painel'))
      .finally(() => setLoading(false));
  }, [id, router]);

  useEffect(() => {
    setMetrics(getMetrics());
    setTransactions(getTransactions(filters));
  }, [filters]);

  const refresh = () => {
    setMetrics(getMetrics());
    setTransactions(getTransactions(filters));
  };

  const handleStatusChange = (txId: string, status: TransactionStatus) => {
    setTransactionStatus(txId, status);
    refresh();
  };
  const handleApprove1 = (txId: string) => {
    approveStep1(txId);
    refresh();
  };
  const handleApprove2 = (txId: string) => {
    approveStep2(txId);
    refresh();
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-r-transparent" />
      </div>
    );
  }

  if (!department) return null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold text-secondary-900 tracking-tight">
          {department.name} – {t('dept.dashboard')}
        </h2>
        <p className="mt-1.5 text-sm text-secondary-600">
          Dashboard e workflow exclusivo do departamento {department.name}.
        </p>
      </div>

      <KpiCards items={getDashboardKpis(metrics)} />

      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <Button onClick={() => setAddOpen(true)}>{t('andamento.add')}</Button>
        </div>
        <TransactionsTable
          transactions={transactions}
          filters={filters}
          onFiltersChange={setFilters}
          onStatusChange={handleStatusChange}
          onApprove1={handleApprove1}
          onApprove2={handleApprove2}
        />
      </div>

      <AddDemandModal open={addOpen} onClose={() => setAddOpen(false)} onSuccess={refresh} />
    </div>
  );
}
