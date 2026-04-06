/**
 * A/P Report PDF – geração de relatório A/P em PDF (jspdf + jspdf-autotable).
 */

import type { ApReportFilters } from './ap-reports.service';
import { getApReportData } from './ap-reports.service';

// @ts-ignore – jspdf
import { jsPDF } from 'jspdf';
// @ts-ignore – jspdf-autotable
import autoTable from 'jspdf-autotable';

export function generateApReportPdf(filters: ApReportFilters = {}): jsPDF {
  const data = getApReportData(filters);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  let y = 18;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('A/P Report – Accounts Payable', 14, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${data.generatedAt.slice(0, 19).replace('T', ' ')}`, 14, y);
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.text('KPIs', 14, y);
  y += 6;
  const kpiRows = data.kpis.map((k) => [k.label, String(k.value)]);
  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Value']],
    body: kpiRows,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
    styles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: w - 80 - 28 } },
    margin: { left: 14 },
  });
  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 10;

  doc.setFont('helvetica', 'bold');
  doc.text('Vendor Concentration (Top 10)', 14, y);
  y += 6;
  const vendorRows = data.vendorConcentration.slice(0, 10).map((v) => [v.vendor, String(v.amount), `${v.percent}%`]);
  autoTable(doc, {
    startY: y,
    head: [['Vendor', 'Amount', '%']],
    body: vendorRows,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
    styles: { fontSize: 8 },
    margin: { left: 14 },
  });
  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 10;

  if (y > 240) {
    doc.addPage();
    y = 18;
  }
  doc.setFont('helvetica', 'bold');
  doc.text('Monthly A/P Trends', 14, y);
  y += 6;
  const trendRows = data.monthlyTrends.map((t) => [t.label, String(t.outstanding), String(t.paid), String(t.overdue)]);
  autoTable(doc, {
    startY: y,
    head: [['Month', 'Outstanding', 'Paid', 'Overdue']],
    body: trendRows,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
    styles: { fontSize: 7 },
    margin: { left: 14 },
  });

  return doc;
}

export function downloadApReportPdf(filters: ApReportFilters = {}, filename?: string): void {
  const doc = generateApReportPdf(filters);
  const name = filename ?? `ap-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(name);
}
