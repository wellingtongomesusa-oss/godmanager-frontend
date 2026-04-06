'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/language-context';
import { formatCurrency } from '@/lib/utils';
import {
  type Transaction,
  type TransactionFilters,
  type TransactionStatus,
  type TipoDemanda,
  TIPO_DEMANDA_LABELS,
  getApprovalDisplayKey,
} from '@/services/admin/admin-dashboard.service';

function statusBadgeClass(s: string): string {
  if (s === 'feito') return 'bg-success-100 text-success-700';
  if (s === 'aguardando') return 'bg-accent-100 text-accent-700';
  if (s === 'cancelada') return 'bg-danger-100 text-danger-700';
  return 'bg-secondary-100 text-secondary-700';
}

function approvalLabelClass(t: Transaction): string {
  if (t.status === 'cancelada') return 'bg-danger-100 text-danger-700';
  if (t.status === 'feito') return 'bg-success-100 text-success-700';
  if (t.statusAprovador1 === 'pendente') return 'bg-accent-100 text-accent-700';
  if (t.statusAprovador2 === 'pendente') return 'bg-primary-100 text-primary-700';
  return 'bg-success-100 text-success-700';
}

interface Props {
  transactions: Transaction[];
  filters: TransactionFilters;
  onFiltersChange: (f: TransactionFilters) => void;
  onStatusChange: (id: string, status: TransactionStatus) => void;
  onApprove1: (id: string) => void;
  onApprove2: (id: string) => void;
}

export function TransactionsTable({ transactions, filters, onFiltersChange, onStatusChange, onApprove1, onApprove2 }: Props) {
  const { t } = useLanguage();

  const setFilter = <K extends keyof TransactionFilters>(key: K, value: TransactionFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const demandLabel = (td: TipoDemanda) => t(`demand.${td}` as import('@/lib/i18n/translations').TranslationKey);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('table.pedidos')}</CardTitle>
        <CardDescription>{t('table.pedidosDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-secondary-700">{t('table.status')}</label>
            <select value={filters.status ?? ''} onChange={(e) => setFilter('status', e.target.value as TransactionStatus | '')} className="flex h-11 w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">{t('table.filters.status')}</option>
              <option value="feito">{t('table.status.feito')}</option>
              <option value="aguardando">{t('table.status.aguardando')}</option>
              <option value="cancelada">{t('table.status.cancelada')}</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-secondary-700">{t('table.tipoDemanda')}</label>
            <select value={filters.tipoDemanda ?? ''} onChange={(e) => setFilter('tipoDemanda', e.target.value as TipoDemanda | '')} className="flex h-11 w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">{t('table.filters.tipo')}</option>
              {(Object.keys(TIPO_DEMANDA_LABELS) as TipoDemanda[]).map((opt) => (
                <option key={opt} value={opt}>{demandLabel(opt)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-secondary-700">{t('table.pais')}</label>
            <select value={filters.pais ?? ''} onChange={(e) => setFilter('pais', e.target.value || undefined)} className="flex h-11 w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">{t('table.filters.pais')}</option>
              <option value="BR">{t('country.BR')}</option>
              <option value="US">{t('country.US')}</option>
              <option value="CA">{t('country.CA')}</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-secondary-700">{t('table.filters.dataInicio')}</label>
            <input type="date" value={filters.dataInicio ?? ''} onChange={(e) => setFilter('dataInicio', e.target.value || undefined)} className="flex h-11 w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-secondary-700">{t('table.filters.dataFim')}</label>
            <input type="date" value={filters.dataFim ?? ''} onChange={(e) => setFilter('dataFim', e.target.value || undefined)} className="flex h-11 w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border border-secondary-200">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-secondary-200 bg-secondary-50">
                <th className="px-4 py-3 font-semibold text-secondary-900">{t('table.cliente')}</th>
                <th className="px-4 py-3 font-semibold text-secondary-900">{t('table.tipoDemanda')}</th>
                <th className="px-4 py-3 font-semibold text-secondary-900">{t('table.data')}</th>
                <th className="px-4 py-3 font-semibold text-secondary-900">{t('table.valor')}</th>
                <th className="px-4 py-3 font-semibold text-secondary-900">{t('table.pais')}</th>
                <th className="px-4 py-3 font-semibold text-secondary-900">{t('table.status')}</th>
                <th className="px-4 py-3 font-semibold text-secondary-900">{t('table.duplaAlcada')}</th>
                <th className="px-4 py-3 font-semibold text-secondary-900">{t('table.acoes')}</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-secondary-500">{t('table.empty')}</td>
                </tr>
              ) : (
                transactions.map((tr) => (
                  <tr key={tr.id} className="border-b border-secondary-100 hover:bg-secondary-50/80">
                    <td className="px-4 py-3 text-secondary-700">{tr.cliente}</td>
                    <td className="px-4 py-3 text-secondary-700">{demandLabel(tr.tipoDemanda)}</td>
                    <td className="px-4 py-3 text-secondary-700">{tr.data}</td>
                    <td className="px-4 py-3 text-secondary-700">{tr.valor != null ? formatCurrency(tr.valor, tr.moeda) : '—'}</td>
                    <td className="px-4 py-3 text-secondary-700">{[tr.paisOrigem, tr.paisDestino].filter(Boolean).join(' → ') || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex rounded-full px-2 py-1 text-xs font-medium', statusBadgeClass(tr.status))}>
                        {t(`table.status.${tr.status}` as import('@/lib/i18n/translations').TranslationKey)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex rounded-full px-2 py-1 text-xs font-medium', approvalLabelClass(tr))}>
                        {t(getApprovalDisplayKey(tr))}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {tr.status !== 'cancelada' && (
                          <>
                            {tr.statusAprovador1 === 'pendente' && (
                              <Button size="sm" variant="outline" className="text-xs" onClick={() => onApprove1(tr.id)}>{t('table.approve1')}</Button>
                            )}
                            {tr.statusAprovador1 === 'aprovado' && tr.statusAprovador2 === 'pendente' && (
                              <Button size="sm" variant="outline" className="text-xs" onClick={() => onApprove2(tr.id)}>{t('table.approve2')}</Button>
                            )}
                          </>
                        )}
                        <Button size="sm" variant="ghost" className={cn('text-xs', tr.status === 'feito' && 'bg-success-100 text-success-700')} onClick={() => onStatusChange(tr.id, 'feito')}>{t('table.status.feito')}</Button>
                        <Button size="sm" variant="ghost" className={cn('text-xs', tr.status === 'aguardando' && 'bg-accent-100 text-accent-700')} onClick={() => onStatusChange(tr.id, 'aguardando')}>{t('table.status.aguardando')}</Button>
                        <Button size="sm" variant="ghost" className={cn('text-xs text-danger-600 hover:bg-danger-50', tr.status === 'cancelada' && 'bg-danger-100')} onClick={() => onStatusChange(tr.id, 'cancelada')}>{t('table.status.cancelada')}</Button>
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
