'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { KpiCards } from '@/components/admin/kpi-cards';
import { ChartProjecoesAtuais, ChartFaturamento, ChartCategorias } from '@/components/admin/dashboard-charts';
import { TransactionsTable } from '@/components/admin/transactions-table';
import { AddDemandModal } from '@/components/admin/add-demand-modal';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/language-context';
import {
  getMetrics,
  getTransactions,
  getDashboardKpis,
  getProjecoesAtuaisData,
  getFaturamentoData,
  getCategoriasData,
  setTransactionStatus,
  approveStep1,
  approveStep2,
  type Transaction,
  type TransactionFilters,
  type TransactionStatus,
} from '@/services/admin/admin-dashboard.service';

export default function AdminDashboardPage() {
  const { t } = useLanguage();
  const [metrics, setMetrics] = useState(() => getMetrics());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filters, setFilters] = useState<TransactionFilters>({});
  const [addModalOpen, setAddModalOpen] = useState(false);

  const kpis = useMemo(() => getDashboardKpis(metrics), [metrics]);
  const projecoesData = useMemo(() => getProjecoesAtuaisData(), []);
  const faturamentoData = useMemo(() => getFaturamentoData(), []);
  const categoriasData = useMemo(() => getCategoriasData(), []);
  const semanaAtual = faturamentoData[faturamentoData.length - 1]?.atual ?? 0;
  const semanaAnterior = faturamentoData[faturamentoData.length - 1]?.anterior ?? 0;

  const refresh = useCallback(() => {
    setMetrics(getMetrics());
    setTransactions(getTransactions(filters));
  }, [filters]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleStatusChange = useCallback((id: string, status: TransactionStatus) => {
    setTransactionStatus(id, status);
    refresh();
  }, [refresh]);

  const handleApprove1 = useCallback((id: string) => {
    approveStep1(id);
    refresh();
  }, [refresh]);

  const handleApprove2 = useCallback((id: string) => {
    approveStep2(id);
    refresh();
  }, [refresh]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-secondary-900">{t('sidebar.painel')}</h1>
        <Button onClick={() => setAddModalOpen(true)} size="lg" className="shadow-md">
          Add+
        </Button>
      </div>
      <section aria-label="Métricas" className="space-y-4">
        <KpiCards items={kpis} />
      </section>
      <section aria-label="Projeções" className="space-y-4">
        <ChartProjecoesAtuais data={projecoesData} />
      </section>
      <section aria-label="Gráficos" className="grid gap-6 lg:grid-cols-2">
        <ChartFaturamento data={faturamentoData} semanaAtual={semanaAtual} semanaAnterior={semanaAnterior} />
        <ChartCategorias data={categoriasData} />
      </section>
      <section id="novos-pedidos" aria-label="Novos pedidos">
        <TransactionsTable
          transactions={transactions}
          filters={filters}
          onFiltersChange={setFilters}
          onStatusChange={handleStatusChange}
          onApprove1={handleApprove1}
          onApprove2={handleApprove2}
        />
      </section>
      <AddDemandModal open={addModalOpen} onClose={() => setAddModalOpen(false)} onSuccess={refresh} />
    </div>
  );
}
