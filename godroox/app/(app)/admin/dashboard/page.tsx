'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KpiCards,
  ChartProjecoesAtuais,
  ChartFaturamento,
  ChartCategorias,
  TransactionsTable,
} from '@/components/admin';
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
  const [metrics, setMetrics] = useState(() => getMetrics());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filters, setFilters] = useState<TransactionFilters>({});

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

  const handleStatusChange = useCallback(
    (id: string, status: TransactionStatus) => {
      setTransactionStatus(id, status);
      refresh();
    },
    [refresh]
  );

  const handleApprove1 = useCallback(
    (id: string) => {
      approveStep1(id);
      refresh();
    },
    [refresh]
  );

  const handleApprove2 = useCallback(
    (id: string) => {
      approveStep2(id);
      refresh();
    },
    [refresh]
  );

  return (
    <div className="space-y-6">
      {/* KPIs — estilo Painel de Bordo */}
      <KpiCards items={kpis} />

      {/* Gráfico Projeções x Atuais */}
      <ChartProjecoesAtuais data={projecoesData} />

      {/* Faturamento e Categorias lado a lado */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartFaturamento
          data={faturamentoData}
          semanaAtual={semanaAtual}
          semanaAnterior={semanaAnterior}
        />
        <ChartCategorias data={categoriasData} />
      </div>

      {/* Pedidos dos usuários em linhas (parte de baixo) */}
      <div>
        <TransactionsTable
          transactions={transactions}
          filters={filters}
          onFiltersChange={setFilters}
          onStatusChange={handleStatusChange}
          onApprove1={handleApprove1}
          onApprove2={handleApprove2}
        />
      </div>
    </div>
  );
}
