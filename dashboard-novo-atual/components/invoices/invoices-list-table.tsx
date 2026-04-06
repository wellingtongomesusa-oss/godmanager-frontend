'use client';

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/language-context';
import { formatCurrency, cn } from '@/lib/utils';
import {
  getInvoices,
  sortInvoices,
  paginateInvoices,
  type Invoice,
  type InvoiceFilters,
  type InvoiceStatus,
  type InvoiceCurrency,
  type InvoiceSortField,
  type InvoiceSortOrder,
} from '@/services/invoices/invoices.service';
import { sendInvoiceEmail } from '@/services/email';

const STATUS_OPTIONS: { value: InvoiceStatus | ''; labelKey: 'inv.filters.status' | 'inv.status.pago' | 'inv.status.em_aberto' | 'inv.status.atrasado' | 'inv.status.cancelado' }[] = [
  { value: '', labelKey: 'inv.filters.status' },
  { value: 'pago', labelKey: 'inv.status.pago' },
  { value: 'em_aberto', labelKey: 'inv.status.em_aberto' },
  { value: 'atrasado', labelKey: 'inv.status.atrasado' },
  { value: 'cancelado', labelKey: 'inv.status.cancelado' },
];

const CURRENCY_OPTIONS: { value: InvoiceCurrency | '' }[] = [
  { value: '' },
  { value: 'USD' },
  { value: 'BRL' },
  { value: 'EUR' },
];

const PER_PAGE = 10;

export function InvoicesListTable() {
  const { t } = useLanguage();
  const router = useRouter();
  const [filters, setFilters] = useState<InvoiceFilters>({});
  const [sortField, setSortField] = useState<InvoiceSortField>('emissionDate');
  const [sortOrder, setSortOrder] = useState<InvoiceSortOrder>('desc');
  const [page, setPage] = useState(1);
  const [emailSending, setEmailSending] = useState<string | null>(null);

  const filtered = useMemo(() => getInvoices(filters), [filters]);
  const sorted = useMemo(() => sortInvoices(filtered, sortField, sortOrder), [filtered, sortField, sortOrder]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const paginated = useMemo(
    () => paginateInvoices(sorted, page, PER_PAGE),
    [sorted, page]
  );

  const handleFilter = useCallback((key: keyof InvoiceFilters, value: string | undefined) => {
    setFilters((f) => ({ ...f, [key]: value || undefined }));
    setPage(1);
  }, []);

  const handleSort = useCallback((field: InvoiceSortField) => {
    setSortField(field);
    setSortOrder((o) => (sortField === field && o === 'desc' ? 'asc' : 'desc'));
  }, [sortField]);

  const handleDownloadPdf = useCallback(async (inv: Invoice) => {
    try {
      const { downloadInvoicePdf } = await import('@/services/invoices/pdf-invoice');
      downloadInvoicePdf(inv);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      alert(t('inv.downloadPdf') + ' – Erro. Tente novamente.');
    }
  }, [t]);

  const handleSendEmail = useCallback(
    async (inv: Invoice) => {
      const to = inv.client.email;
      if (!to) return;
      setEmailSending(inv.id);
      try {
        const res = await sendInvoiceEmail(inv, to);
        if (res.success) alert(t('inv.email.success'));
        else alert(t('inv.email.error') + (res.error ? `: ${res.error}` : ''));
      } finally {
        setEmailSending(null);
      }
    },
    [t]
  );

  const handleSendWhatsApp = useCallback((inv: Invoice) => {
    const phone = inv.client.phone?.replace(/\D/g, '') ?? '';
    if (!phone) return;
    const prefix = phone.startsWith('55') ? '' : '55';
    const num = prefix + phone;
    const text = encodeURIComponent(
      `Olá! Segue a Invoice ${inv.number} – ${inv.company.name}. Valor total: ${inv.currency} ${inv.total.toFixed(2)}. Acesse o dashboard para baixar o PDF.`
    );
    const url = `https://wa.me/${num}?text=${text}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const statusLabel = (s: InvoiceStatus) => t(`inv.status.${s}` as 'inv.status.pago' | 'inv.status.em_aberto' | 'inv.status.atrasado' | 'inv.status.cancelado');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 rounded-lg border border-secondary-200 bg-secondary-50/50 p-4">
        <div className="min-w-[140px]">
          <label className="mb-1 block text-xs font-medium text-secondary-600">{t('inv.filters.status')}</label>
          <select
            value={filters.status ?? ''}
            onChange={(e) => handleFilter('status', e.target.value || undefined)}
            className="h-10 w-full rounded-lg border border-secondary-300 bg-white px-3 text-sm text-secondary-900 focus:ring-2 focus:ring-primary-500"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>{t(o.labelKey)}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[120px]">
          <label className="mb-1 block text-xs font-medium text-secondary-600">{t('inv.filters.currency')}</label>
          <select
            value={filters.currency ?? ''}
            onChange={(e) => handleFilter('currency', e.target.value || undefined)}
            className="h-10 w-full rounded-lg border border-secondary-300 bg-white px-3 text-sm text-secondary-900 focus:ring-2 focus:ring-primary-500"
          >
            {CURRENCY_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>{o.value || t('inv.filters.currency')}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[160px]">
          <label className="mb-1 block text-xs font-medium text-secondary-600">{t('inv.filters.client')}</label>
          <input
            type="text"
            value={filters.clientName ?? ''}
            onChange={(e) => handleFilter('clientName', e.target.value || undefined)}
            placeholder={t('inv.filters.client')}
            className="h-10 w-full rounded-lg border border-secondary-300 bg-white px-3 text-sm text-secondary-900 focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="min-w-[140px]">
          <label className="mb-1 block text-xs font-medium text-secondary-600">{t('inv.filters.dateFrom')}</label>
          <input
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(e) => handleFilter('dateFrom', e.target.value || undefined)}
            className="h-10 w-full rounded-lg border border-secondary-300 bg-white px-3 text-sm text-secondary-900 focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="min-w-[140px]">
          <label className="mb-1 block text-xs font-medium text-secondary-600">{t('inv.filters.dateTo')}</label>
          <input
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(e) => handleFilter('dateTo', e.target.value || undefined)}
            className="h-10 w-full rounded-lg border border-secondary-300 bg-white px-3 text-sm text-secondary-900 focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-secondary-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-secondary-200 bg-secondary-50 text-left text-secondary-600">
              <th className="cursor-pointer px-4 py-3" onClick={() => handleSort('emissionDate')}>
                {t('inv.number')} / {t('inv.emissionDate')} ↕
              </th>
              <th className="px-4 py-3">{t('inv.client')}</th>
              <th className="cursor-pointer px-4 py-3" onClick={() => handleSort('dueDate')}>{t('inv.dueDate')} ↕</th>
              <th className="cursor-pointer px-4 py-3" onClick={() => handleSort('status')}>{t('inv.status')} ↕</th>
              <th className="cursor-pointer px-4 py-3" onClick={() => handleSort('total')}>{t('inv.total')} ↕</th>
              <th className="px-4 py-3 text-right">{t('inv.seeDetails')} / {t('inv.edit')}</th>
              <th className="px-4 py-3 text-right">{t('inv.downloadPdf')} / Email / WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-secondary-500">
                  {t('inv.empty')}
                </td>
              </tr>
            ) : (
              paginated.map((inv) => (
                <tr key={inv.id} className="border-b border-secondary-100 hover:bg-secondary-50/50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-secondary-900">{inv.number}</span>
                    <br />
                    <span className="text-xs text-secondary-500">{inv.emissionDate}</span>
                  </td>
                  <td className="px-4 py-3">{inv.client.name}</td>
                  <td className="px-4 py-3">{inv.dueDate}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        inv.status === 'pago' && 'bg-green-100 text-green-800',
                        inv.status === 'em_aberto' && 'bg-amber-100 text-amber-800',
                        inv.status === 'atrasado' && 'bg-red-100 text-red-800',
                        inv.status === 'cancelado' && 'bg-secondary-200 text-secondary-700'
                      )}
                    >
                      {statusLabel(inv.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(inv.total, inv.currency)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/invoices/${inv.id}`}>
                      <Button variant="ghost" size="sm">{t('inv.seeDetails')}</Button>
                    </Link>
                    <Link href={`/admin/invoices/${inv.id}/edit`} className="ml-1">
                      <Button variant="ghost" size="sm">{t('inv.edit')}</Button>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleDownloadPdf(inv)}>
                      {t('inv.downloadPdf')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSendEmail(inv)}
                      disabled={!inv.client.email || emailSending === inv.id}
                    >
                      {t('inv.sendEmail')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleSendWhatsApp(inv)} disabled={!inv.client.phone}>
                      {t('inv.sendWhatsApp')}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-secondary-600">
            Page {page} of {totalPages} · {sorted.length} invoices
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
