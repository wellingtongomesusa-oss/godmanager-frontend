/**
 * Export 1099 recipients to PDF (jspdf + jspdf-autotable).
 */

import type { Form1099Type } from '@/services/1099.service';
import { get1099ExportData } from '@/services/1099.service';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { jsPDF } from 'jspdf';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import autoTable from 'jspdf-autotable';

export function download1099Pdf(
  filters: { formType?: Form1099Type; taxYear?: number } = {},
  filename?: string
): void {
  const data = get1099ExportData(filters);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('1099 Recipients', 14, 18);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Generated: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} • Form: ${filters.formType ?? 'All'} • Year: ${filters.taxYear ?? 'All'}`,
    14,
    25
  );
  if (data.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.text('No recipients to export.', 14, 35);
    doc.save(filename ?? '1099-export.pdf');
    return;
  }

  const rows = data.map((r) => [
    String(r['Form Type']),
    String(r['Tax Year']),
    String(r['Recipient Name']),
    String(r.TIN),
    String(r['Amount (USD)']),
  ]);
  autoTable(doc, {
    startY: 32,
    head: [['Form Type', 'Tax Year', 'Recipient Name', 'TIN', 'Amount (USD)']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [234, 88, 12], fontSize: 9 },
    styles: { fontSize: 8 },
    margin: { left: 14 },
  });

  const name = filename ?? `1099-${filters.formType ?? 'all'}-${filters.taxYear ?? 'all'}.pdf`;
  doc.save(name);
}
