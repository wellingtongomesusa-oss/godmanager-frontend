'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MetricCards, TransactionsTable, CadastrosSection } from '@/components/admin';
import type { AdminMetrics } from '@/components/admin';
import {
  getMetrics,
  getTransactions,
  setTransactionStatus,
  approveStep1,
  approveStep2,
  TIPO_DEMANDA_LABELS,
  type Transaction,
  type TransactionFilters,
  type TransactionStatus,
  type TipoDemanda,
} from '@/services/admin/admin-dashboard.service';

const PRODUTO_SLUGS: TipoDemanda[] = [
  'life_insurance',
  'llc_florida',
  'pagamentos_internacionais',
  'godroox_pro',
];

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const produtoSlug = searchParams.get('produto') ?? '';

  const [metrics, setMetrics] = useState<AdminMetrics>({
    contasCadastradas: 0,
    transacoesTotais: 0,
    transacoesConcluidas: 0,
    transacoesPendentes: 0,
    transacoesCanceladas: 0,
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filters, setFilters] = useState<TransactionFilters>({});

  const tipoDemanda = useMemo(() => {
    if (PRODUTO_SLUGS.includes(produtoSlug as TipoDemanda)) return produtoSlug as TipoDemanda;
    return undefined;
  }, [produtoSlug]);

  const filtersWithProduto = useMemo(
    () => (tipoDemanda ? { ...filters, tipoDemanda } : filters),
    [filters, tipoDemanda]
  );

  const refresh = useCallback(() => {
    setMetrics(getMetrics());
    setTransactions(getTransactions(filtersWithProduto));
  }, [filtersWithProduto]);

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

  const tituloProduto = tipoDemanda ? TIPO_DEMANDA_LABELS[tipoDemanda] : null;
  const somenteProduto = !!tipoDemanda;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-white">
          {tituloProduto ?? 'Visão geral'}
        </h2>
        <p className="mt-1 text-sm text-brand-muted">
          {tituloProduto
            ? `Apenas dados do produto: ${tituloProduto}`
            : 'Métricas e transações da plataforma Godroox'}
        </p>
      </div>

      {!somenteProduto && (
        <>
          <MetricCards metrics={metrics} />
          <CadastrosSection />
        </>
      )}

      <TransactionsTable
        transactions={transactions}
        filters={filtersWithProduto}
        onFiltersChange={setFilters}
        onStatusChange={handleStatusChange}
        onApprove1={handleApprove1}
        onApprove2={handleApprove2}
      />
      {somenteProduto && (
        <p className="text-center text-sm text-brand-muted">
          Clique em &quot;Visão geral&quot; no menu para ver métricas e cadastros.
        </p>
      )}
    </div>
  );
}
