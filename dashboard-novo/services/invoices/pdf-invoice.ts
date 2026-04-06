/**
 * PDF Invoice – geração de PDF para invoices (jspdf + jspdf-autotable).
 * Uso: gerar e baixar ou obter blob para anexo em e-mail.
 * Execute `npm install` para resolver "Module not found: jspdf".
 */

// @ts-ignore — jspdf
import { jsPDF } from 'jspdf';
// @ts-ignore — jspdf-autotable
import autoTable from 'jspdf-autotable';
import type { Invoice } from './invoices.service';
import { formatCurrency } from '@/lib/utils';

const FONT = 'helvetica';
const FONT_BOLD = 'helvetica';
const TITLE_SIZE = 18;
const NORMAL_SIZE = 10;
const SMALL_SIZE = 8;

export function generateInvoicePdf(invoice: Invoice): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFontSize(TITLE_SIZE);
  doc.setFont(FONT_BOLD, 'bold');
  doc.text('INVOICE', 14, y);
  y += 10;

  doc.setFontSize(NORMAL_SIZE);
  doc.setFont(FONT, 'normal');
  doc.text(invoice.company.name, 14, y);
  y += 5;
  doc.setFontSize(SMALL_SIZE);
  doc.text(invoice.company.address, 14, y);
  y += 4;
  doc.text(`${invoice.company.city}, ${invoice.company.state} ${invoice.company.zip}`, 14, y);
  y += 4;
  doc.text(invoice.company.country, 14, y);
  y += 4;
  doc.text(invoice.company.email, 14, y);
  y += 4;
  doc.text(invoice.company.phone, 14, y);
  y += 12;

  const colRight = pageW - 14;
  doc.setFontSize(NORMAL_SIZE);
  doc.text(`Invoice #: ${invoice.number}`, colRight, 20, { align: 'right' });
  doc.text(`Date: ${invoice.emissionDate}`, colRight, 26, { align: 'right' });
  doc.text(`Due: ${invoice.dueDate}`, colRight, 32, { align: 'right' });
  doc.text(`Currency: ${invoice.currency}`, colRight, 38, { align: 'right' });
  doc.text(`Terms: ${invoice.paymentTerms}`, colRight, 44, { align: 'right' });

  doc.setFont(FONT_BOLD, 'bold');
  doc.setFontSize(NORMAL_SIZE);
  doc.text('Bill To', 14, y);
  y += 6;
  doc.setFont(FONT, 'normal');
  doc.text(invoice.client.name, 14, y);
  y += 5;
  doc.setFontSize(SMALL_SIZE);
  doc.text(invoice.client.address, 14, y);
  y += 4;
  doc.text(invoice.client.country, 14, y);
  y += 4;
  doc.text(invoice.client.email, 14, y);
  y += 4;
  doc.text(invoice.client.phone, 14, y);
  y += 14;

  const headers = [['Description', 'Qty', 'Unit Price', 'Tax %', 'Tax', 'Total']];
  const body = invoice.items.map((it) => [
    it.description,
    String(it.quantity),
    formatCurrency(it.unitPrice, invoice.currency),
    `${it.taxPercent}%`,
    formatCurrency(it.taxAmount, invoice.currency),
    formatCurrency(it.lineTotal, invoice.currency),
  ]);

  autoTable(doc, {
    startY: y,
    head: headers,
    body,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
    styles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 15 },
      2: { cellWidth: 28 },
      3: { cellWidth: 18 },
      4: { cellWidth: 25 },
      5: { cellWidth: 30 },
    },
  });

  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40) + 10;

  const totalsX = pageW - 60;
  doc.setFont(FONT, 'normal');
  doc.setFontSize(NORMAL_SIZE);
  doc.text('Subtotal:', totalsX, y);
  doc.text(formatCurrency(invoice.subtotal, invoice.currency), pageW - 14, y, { align: 'right' });
  y += 6;
  doc.text('Taxes:', totalsX, y);
  doc.text(formatCurrency(invoice.taxes, invoice.currency), pageW - 14, y, { align: 'right' });
  y += 6;
  if (invoice.discounts > 0) {
    doc.text('Discounts:', totalsX, y);
    doc.text(`-${formatCurrency(invoice.discounts, invoice.currency)}`, pageW - 14, y, { align: 'right' });
    y += 6;
  }
  doc.setFont(FONT_BOLD, 'bold');
  doc.text('Total:', totalsX, y);
  doc.text(formatCurrency(invoice.total, invoice.currency), pageW - 14, y, { align: 'right' });
  y += 10;

  if (invoice.notes?.trim()) {
    doc.setFont(FONT, 'normal');
    doc.setFontSize(SMALL_SIZE);
    doc.text('Notes:', 14, y);
    y += 5;
    const split = doc.splitTextToSize(invoice.notes, pageW - 28);
    doc.text(split, 14, y);
  }

  return doc;
}

export function downloadInvoicePdf(invoice: Invoice, filename?: string): void {
  const doc = generateInvoicePdf(invoice);
  const name = filename ?? `invoice-${invoice.number}.pdf`;
  doc.save(name);
}

export function getInvoicePdfBlob(invoice: Invoice): Blob {
  const doc = generateInvoicePdf(invoice);
  return doc.output('blob');
}
