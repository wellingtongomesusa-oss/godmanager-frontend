'use client';

import React, { useEffect } from 'react';
import { formatCurrency, getSubtotal } from '@/lib/invoice-utils';
import { formatDateDisplay } from './invoice-form-utils';

export interface InvoicePreviewData {
  plan: string;
  payerCompany: string;
  billingCompany: string;
  serviceDate: string;
  invoiceDate: string;
  lineItems: Array<{ id: string; description: string; quantity: number; unitPrice: number }>;
  total: number;
  invoiceNumber: string;
}

export function InvoicePreviewModal({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: InvoicePreviewData;
}) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-title"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white shadow-2xl"
        style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
        ref={(el) => el?.focus()}
        tabIndex={-1}
      >
        <div className="sticky top-0 flex justify-end border-b border-gray-200 bg-white p-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-invoice-body hover:bg-gray-100"
            aria-label="Fechar"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div id="invoice-preview-content" className="p-8">
          <h2 id="preview-title" className="text-lg font-semibold text-invoice-heading mb-6">
            Preview – Fatura {data.invoiceNumber}
          </h2>
          <div className="mb-6 flex justify-between border-b border-gray-200 pb-4">
            <div>
              <p className="text-sm text-invoice-body">Cobrança</p>
              <p className="font-medium text-invoice-heading">{data.billingCompany || '—'}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-invoice-body">Pagador</p>
              <p className="font-medium text-invoice-heading">{data.payerCompany || '—'}</p>
            </div>
          </div>
          <div className="mb-4 flex gap-6 text-sm text-invoice-body">
            <span>Data do serviço: {formatDateDisplay(data.serviceDate)}</span>
            <span>Data da fatura: {formatDateDisplay(data.invoiceDate)}</span>
          </div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-invoice-body">
                <th className="py-2 font-medium">Descrição</th>
                <th className="py-2 font-medium text-right w-20">Qtd</th>
                <th className="py-2 font-medium text-right w-28">Preço unit.</th>
                <th className="py-2 font-medium text-right w-28">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {data.lineItems.map((item) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-2 text-invoice-heading">{item.description || '—'}</td>
                  <td className="py-2 text-right text-invoice-body">{item.quantity}</td>
                  <td className="py-2 text-right text-invoice-body">{formatCurrency(item.unitPrice)}</td>
                  <td className="py-2 text-right font-medium text-invoice-heading">{formatCurrency(getSubtotal(item))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-6 flex justify-end border-t border-gray-200 pt-4">
            <p className="text-lg font-bold text-invoice-heading">
              Total: {formatCurrency(data.total)}
            </p>
          </div>
          <p className="mt-6 text-xs text-invoice-body">
            Instruções de pagamento: enviar transferência para os dados informados pela empresa cobradora.
          </p>
        </div>
      </div>
    </div>
  );
}
