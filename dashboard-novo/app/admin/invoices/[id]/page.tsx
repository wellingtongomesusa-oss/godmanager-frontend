'use client';

import React, { useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/language-context';
import { formatCurrency } from '@/lib/utils';
import { getInvoiceById } from '@/services/invoices/invoices.service';
import { sendInvoiceEmail } from '@/services/email';

export default function InvoiceDetailPage() {
  const params = useParams();
  const { t } = useLanguage();
  const id = typeof params?.id === 'string' ? params.id : '';

  const invoice = useMemo(() => getInvoiceById(id), [id]);

  const [emailSending, setEmailSending] = React.useState(false);

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

  const statusLabel = t(`inv.status.${invoice.status}` as 'inv.status.pago' | 'inv.status.em_aberto' | 'inv.status.atrasado' | 'inv.status.cancelado');

  const handleDownloadPdf = async () => {
    try {
      const { downloadInvoicePdf } = await import('@/services/invoices/pdf-invoice');
      downloadInvoicePdf(invoice);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      alert(t('inv.downloadPdf') + ' – Erro. Tente novamente.');
    }
  };
  const handleSendEmail = async () => {
    if (!invoice.client.email) return;
    setEmailSending(true);
    try {
      const res = await sendInvoiceEmail(invoice, invoice.client.email);
      if (res.success) alert(t('inv.email.success'));
      else alert(t('inv.email.error') + (res.error ? `: ${res.error}` : ''));
    } finally {
      setEmailSending(false);
    }
  };
  const handleSendWhatsApp = () => {
    const phone = invoice.client.phone?.replace(/\D/g, '') ?? '';
    if (!phone) return;
    const prefix = phone.startsWith('55') ? '' : '55';
    const num = prefix + phone;
    const text = encodeURIComponent(
      `Olá! Segue a Invoice ${invoice.number} – ${invoice.company.name}. Valor total: ${invoice.currency} ${invoice.total.toFixed(2)}. Acesse o dashboard para baixar o PDF.`
    );
    window.open(`https://wa.me/${num}?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-secondary-900">
          {t('inv.number')} {invoice.number}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleDownloadPdf}>
            {t('inv.downloadPdf')}
          </Button>
          <Button
            variant="outline"
            onClick={handleSendEmail}
            disabled={!invoice.client.email || emailSending}
          >
            {t('inv.sendEmail')}
          </Button>
          <Button variant="outline" onClick={handleSendWhatsApp} disabled={!invoice.client.phone}>
            {t('inv.sendWhatsApp')}
          </Button>
          <Link href={`/admin/invoices/${invoice.id}/edit`}>
            <Button variant="outline">{t('inv.edit')}</Button>
          </Link>
          <Link href="/admin/invoices">
            <Button variant="ghost">← {t('inv.title')}</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('inv.form.clientTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium text-secondary-900">{invoice.client.name}</p>
            <p className="text-secondary-600">{invoice.client.address}</p>
            <p className="text-secondary-600">{invoice.client.country}</p>
            <p className="text-secondary-600">{invoice.client.email}</p>
            <p className="text-secondary-600">{invoice.client.phone}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('inv.form.invoiceTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p><span className="text-secondary-600">{t('inv.emissionDate')}:</span> {invoice.emissionDate}</p>
            <p><span className="text-secondary-600">{t('inv.dueDate')}:</span> {invoice.dueDate}</p>
            <p><span className="text-secondary-600">{t('inv.form.currency')}:</span> {invoice.currency}</p>
            <p><span className="text-secondary-600">{t('inv.form.paymentTerms')}:</span> {invoice.paymentTerms}</p>
            <p><span className="text-secondary-600">{t('inv.status')}:</span> {statusLabel}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('inv.form.items')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-secondary-200 text-left text-secondary-600">
                  <th className="pb-2 pr-4">{t('inv.form.description')}</th>
                  <th className="w-16 pb-2 pr-4">{t('inv.form.quantity')}</th>
                  <th className="w-24 pb-2 pr-4">{t('inv.form.unitPrice')}</th>
                  <th className="w-16 pb-2 pr-4">{t('inv.form.tax')}</th>
                  <th className="w-24 pb-2">{t('inv.form.lineTotal')}</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((it) => (
                  <tr key={it.id} className="border-b border-secondary-100">
                    <td className="py-2 pr-4">{it.description}</td>
                    <td className="py-2 pr-4">{it.quantity}</td>
                    <td className="py-2 pr-4">{formatCurrency(it.unitPrice, invoice.currency)}</td>
                    <td className="py-2 pr-4">{it.taxPercent}%</td>
                    <td className="py-2 font-medium">{formatCurrency(it.lineTotal, invoice.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end space-x-6 border-t border-secondary-200 pt-4 text-sm">
            <span>{t('inv.form.subtotal')}: {formatCurrency(invoice.subtotal, invoice.currency)}</span>
            <span>{t('inv.form.taxes')}: {formatCurrency(invoice.taxes, invoice.currency)}</span>
            {invoice.discounts > 0 && (
              <span>{t('inv.form.discounts')}: -{formatCurrency(invoice.discounts, invoice.currency)}</span>
            )}
            <span className="font-semibold">{t('inv.form.total')}: {formatCurrency(invoice.total, invoice.currency)}</span>
          </div>
        </CardContent>
      </Card>

      {invoice.notes?.trim() && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('inv.form.notes')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-secondary-700">{invoice.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
