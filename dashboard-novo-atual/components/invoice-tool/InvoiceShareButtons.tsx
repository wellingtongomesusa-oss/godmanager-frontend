'use client';

import React, { useCallback, useState } from 'react';
import { formatCurrency } from '@/lib/invoice-utils';
import type { LineItem } from '@/lib/invoice-utils';

function formatDateForFilename(dateStr: string): string {
  if (!dateStr) return '';
  return dateStr.replace(/-/g, '');
}

export function InvoiceShareButtons({
  invoiceNumber,
  invoiceDate,
  total,
  isValid,
  payerCompany,
  billingCompany,
  lineItems,
}: {
  invoiceNumber: string;
  invoiceDate: string;
  total: number;
  isValid: boolean;
  payerCompany: string;
  billingCompany: string;
  lineItems: LineItem[];
}) {
  const [downloading, setDownloading] = useState(false);

  const subject = `Fatura ${invoiceNumber}`;
  const body = `Segue a fatura ${invoiceNumber}.\n\nPagador: ${payerCompany}\nTotal: R$ ${total.toFixed(2)}`;

  const handleEmail = useCallback(() => {
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  }, [subject, body]);

  const handleShare = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: subject,
          text: body,
        });
      } catch {
        handleEmail();
      }
    } else {
      handleEmail();
    }
  }, [subject, body, handleEmail]);

  const handleDownloadPdf = useCallback(async () => {
    if (!isValid) return;
    setDownloading(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      await import('jspdf-autotable');
      const doc = new jsPDF();
      const docWithTable = doc as unknown as {
        autoTable: (opts: unknown) => void;
        lastAutoTable: { finalY: number };
      };
      let y = 20;

      doc.setFontSize(18);
      doc.text('Fatura ' + invoiceNumber, 20, y);
      y += 12;

      doc.setFontSize(10);
      doc.text(`Cobrança: ${billingCompany}`, 20, y);
      y += 6;
      doc.text(`Pagador: ${payerCompany}`, 20, y);
      y += 6;
      doc.text(`Data da fatura: ${invoiceDate.split('-').reverse().join('/')}`, 20, y);
      y += 12;

      const tableData = lineItems.map((item) => [
        item.description,
        String(item.quantity),
        formatCurrency(item.unitPrice),
        formatCurrency(item.quantity * item.unitPrice),
      ]);
      docWithTable.autoTable({
        startY: y,
        head: [['Descrição', 'Qtd', 'Preço unit.', 'Subtotal']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [255, 111, 0] },
      });
      y = docWithTable.lastAutoTable.finalY + 10;

      doc.setFontSize(12);
      doc.text(`Total: ${formatCurrency(total)}`, 20, y);

      const filename = `Fatura_${formatDateForFilename(invoiceDate)}.pdf`;
      doc.save(filename);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  }, [isValid, invoiceNumber, invoiceDate, payerCompany, billingCompany, lineItems, total]);

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(subject + '\n\n' + body)}`;

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Compartilhar fatura">
      <span className="text-sm text-invoice-body">Compartilhar:</span>
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#25D366] text-white transition-opacity duration-300 hover:opacity-90"
        aria-label="Compartilhar no WhatsApp"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </a>
      <button
        type="button"
        onClick={handleEmail}
        disabled={!isValid}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-invoice-body transition-colors duration-300 hover:border-invoice-primary hover:text-invoice-primary disabled:opacity-50"
        aria-label="Enviar por e-mail"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
      </button>
      <button
        type="button"
        onClick={handleDownloadPdf}
        disabled={!isValid || downloading}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-invoice-body transition-colors duration-300 hover:border-invoice-primary hover:text-invoice-primary disabled:opacity-50"
        aria-label="Download PDF"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
      </button>
    </div>
  );
}
