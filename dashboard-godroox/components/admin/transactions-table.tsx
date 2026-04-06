'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  type Transaction,
  type TransactionFilters,
  type TransactionStatus,
  type TipoDemanda,
  TIPO_DEMANDA_LABELS,
  getApprovalDisplayLabel,
} from '@/services/admin/admin-dashboard.service';
import { formatCurrency } from '@/lib/utils';

const STATUS_OPTIONS: { value: TransactionStatus | ''; label: string }[] = [
  { value: '', label: 'Todos os status' },
  { value: 'feito', label: 'Feito' },
  { value: 'aguardando', label: 'Aguardando' },
  { value: 'cancelada', label: 'Cancelada' },
];

const TIPO_OPTIONS: { value: TipoDemanda | ''; label: string }[] = [
  { value: '', label: 'Todos os tipos' },
  ...(Object.entries(TIPO_DEMANDA_LABELS) as [TipoDemanda, string][]).map(([value, label]) => ({ value, label })),
];

const PAIS_OPTIONS = [
  { value: '', label: 'Todos os países' },
  { value: 'BR', label: 'Brasil' },
  { value: 'US', label: 'Estados Unidos' },
  { value: 'CA', label: 'Canadá' },
];

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'feito': return 'bg-emerald-100 text-emerald-600';
    case 'aguardando': return 'bg-amber-100 text-amber-600';
    case 'cancelada': return 'bg-rose-100 text-rose-600';
    default: return 'bg-gray-100 text-secondary-600';
  }
}

function approvalLabelClass(t: Transaction): string {
  if (t.status === 'cancelada') return 'bg-rose-100 text-rose-600';
  if (t.status === 'feito') return 'bg-emerald-100 text-emerald-600';
  if (t.statusAprovador1 === 'pendente') return 'bg-amber-100 text-amber-600';
  if (t.statusAprovador2 === 'pendente') return 'bg-primary-100 text-primary-600';
  return 'bg-emerald-100 text-emerald-600';
}

interface TransactionsTableProps {
  transactions: Transaction[];
  filters: TransactionFilters;
  onFiltersChange: (f: TransactionFilters) => void;
  onStatusChange: (id: string, status: TransactionStatus) => void;
  onApprove1: (id: string) => void;
  onApprove2: (id: string) => void;
}

const selectClass =
  'flex h-11 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-secondary-800 placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500';

export function TransactionsTable({
  transactions,
  filters,
  onFiltersChange,
  onStatusChange,
  onApprove1,
  onApprove2,
}: TransactionsTableProps) {
  const setFilter = <K extends keyof TransactionFilters>(key: K, value: TransactionFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <Card className="border-gray-200 bg-white shadow-lg">
      <CardHeader>
        <CardTitle className="text-secondary-900">Pedidos dos usuários</CardTitle>
        <CardDescription className="text-secondary-600">
          Lista de pedidos em linhas. Filtros e dupla alçada disponíveis.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-secondary-700">Status</label>
            <select value={filters.status ?? ''} onChange={(e) => setFilter('status', e.target.value as TransactionStatus | '')} className={selectClass}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-secondary-700">Tipo de demanda</label>
            <select value={filters.tipoDemanda ?? ''} onChange={(e) => setFilter('tipoDemanda', e.target.value as TipoDemanda | '')} className={selectClass}>
              {TIPO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-secondary-700">País</label>
            <select value={filters.pais ?? ''} onChange={(e) => setFilter('pais', e.target.value || undefined)} className={selectClass}>
              {PAIS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-secondary-700">Data início</label>
            <input type="date" value={filters.dataInicio ?? ''} onChange={(e) => setFilter('dataInicio', e.target.value || undefined)} className={selectClass} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-secondary-700">Data fim</label>
            <input type="date" value={filters.dataFim ?? ''} onChange={(e) => setFilter('dataFim', e.target.value || undefined)} className={selectClass} />
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 font-semibold text-secondary-700">Cliente</th>
                <th className="px-4 py-3 font-semibold text-secondary-700">Tipo de demanda</th>
                <th className="px-4 py-3 font-semibold text-secondary-700">Data</th>
                <th className="px-4 py-3 font-semibold text-secondary-700">Valor</th>
                <th className="px-4 py-3 font-semibold text-secondary-700">País origem/destino</th>
                <th className="px-4 py-3 font-semibold text-secondary-700">Status</th>
                <th className="px-4 py-3 font-semibold text-secondary-700">Dupla alçada</th>
                <th className="px-4 py-3 font-semibold text-secondary-700">Ações</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-secondary-500">Nenhuma transação encontrada.</td>
                </tr>
              ) : (
                transactions.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-secondary-700">{t.cliente}</td>
                    <td className="px-4 py-3 text-secondary-700">{TIPO_DEMANDA_LABELS[t.tipoDemanda]}</td>
                    <td className="px-4 py-3 text-secondary-700">{t.data}</td>
                    <td className="px-4 py-3 text-secondary-700">{t.valor != null ? formatCurrency(t.valor, t.moeda) : '—'}</td>
                    <td className="px-4 py-3 text-secondary-700">{[t.paisOrigem, t.paisDestino].filter(Boolean).join(' → ') || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex rounded-full px-2 py-1 text-xs font-medium', statusBadgeClass(t.status))}>{t.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex rounded-full px-2 py-1 text-xs font-medium', approvalLabelClass(t))}>{getApprovalDisplayLabel(t)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {t.status !== 'cancelada' && (
                          <>
                            {t.statusAprovador1 === 'pendente' && <Button size="sm" variant="primary" className="text-xs" onClick={() => onApprove1(t.id)}>1ª aprovação</Button>}
                            {t.statusAprovador1 === 'aprovado' && t.statusAprovador2 === 'pendente' && <Button size="sm" variant="primary" className="text-xs" onClick={() => onApprove2(t.id)}>2ª aprovação</Button>}
                          </>
                        )}
                        <Button size="sm" variant="ghost" className={cn('text-xs text-secondary-600 hover:bg-gray-100', t.status === 'feito' && 'bg-emerald-100 text-emerald-600')} onClick={() => onStatusChange(t.id, 'feito')}>Feito</Button>
                        <Button size="sm" variant="ghost" className={cn('text-xs text-secondary-600 hover:bg-gray-100', t.status === 'aguardando' && 'bg-amber-100 text-amber-600')} onClick={() => onStatusChange(t.id, 'aguardando')}>Aguardando</Button>
                        <Button size="sm" variant="ghost" className={cn('text-xs text-secondary-600 hover:bg-gray-100 hover:text-rose-600', t.status === 'cancelada' && 'bg-rose-100 text-rose-600')} onClick={() => onStatusChange(t.id, 'cancelada')}>Cancelada</Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
