/**
 * Tax Report Export – PDF e CSV do resumo fiscal (IRS & Federal Tax).
 */

import { getTaxReportData, getTaxReportFilings, getTaxReportPayments } from '@/services/irs-report.service';
import { downloadCsv } from '@/lib/csv-export';
// @ts-ignore — jspdf
import { jsPDF } from 'jspdf';
// @ts-ignore — jspdf-autotable
import autoTable from 'jspdf-autotable';

export function exportTaxReportCsv(taxYear?: number): void {
  const data = getTaxReportData({ taxYear });
  const filings = getTaxReportFilings({ taxYear });
  const payments = getTaxReportPayments({ taxYear });
  const rows: Record<string, string | number>[] = [
    { Section: 'Summary', Key: 'Tax Year', Value: data.taxYear, Detail: '' },
    { Section: 'Summary', Key: 'Annual Income', Value: data.annualIncome, Detail: '' },
    { Section: 'Summary', Key: 'Deductible Expenses', Value: data.deductibleExpenses, Detail: '' },
    { Section: 'Summary', Key: 'Estimated Payments', Value: data.estimatedPayments, Detail: '' },
    { Section: 'Summary', Key: 'Projected Tax Due', Value: data.projectedTaxDue, Detail: '' },
    { Section: 'Summary', Key: 'Obligations Pending', Value: data.obligationsPending, Detail: '' },
  ];
  Object.entries(data.deductionsSummary).forEach(([k, v]) => {
    rows.push({ Section: 'Deductions', Key: k, Value: v, Detail: '' });
  });
  filings.forEach((f) => {
    rows.push({ Section: 'Filings', Key: f.formType, Value: f.status, Detail: f.dueDate });
  });
  payments.forEach((p) => {
    rows.push({ Section: 'Payments', Key: p.type, Value: p.amount, Detail: p.date });
  });
  const filename = `tax-report-${data.taxYear}-${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCsv(rows, filename);
}

export function exportTaxReportPdf(taxYear?: number): void {
  const data = getTaxReportData({ taxYear });
  const filings = getTaxReportFilings({ taxYear });
  const payments = getTaxReportPayments({ taxYear });
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  let y = 18;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('IRS & Federal Tax – Tax Summary', 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${data.generatedAt.slice(0, 19).replace('T', ' ')} | Tax Year: ${data.taxYear}`, 14, y);
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.text('Summary', 14, y);
  y += 6;
  const summaryRows = [
    ['Annual Income', `$${data.annualIncome.toLocaleString()}`],
    ['Deductible Expenses', `$${data.deductibleExpenses.toLocaleString()}`],
    ['Estimated Payments', `$${data.estimatedPayments.toLocaleString()}`],
    ['Prior Year Liability', `$${data.priorYearLiability.toLocaleString()}`],
    ['Projected Tax Due', `$${data.projectedTaxDue.toLocaleString()}`],
    ['Obligations Pending', `$${data.obligationsPending.toLocaleString()}`],
  ];
  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Value']],
    body: summaryRows,
    theme: 'grid',
    headStyles: { fillColor: [234, 88, 12], fontSize: 9 },
    styles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: w - 70 - 28 } },
    margin: { left: 14 },
  });
  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 10;

  doc.setFont('helvetica', 'bold');
  doc.text('Deductions Summary', 14, y);
  y += 6;
  const dedRows = Object.entries(data.deductionsSummary).map(([k, v]) => [k, `$${Number(v).toLocaleString()}`]);
  autoTable(doc, {
    startY: y,
    head: [['Category', 'Amount']],
    body: dedRows,
    theme: 'grid',
    headStyles: { fillColor: [234, 88, 12], fontSize: 9 },
    styles: { fontSize: 8 },
    margin: { left: 14 },
  });
  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 10;

  doc.setFont('helvetica', 'bold');
  doc.text('Filings', 14, y);
  y += 6;
  const filingRows = filings.map((f) => [f.formType, f.description, f.status, f.dueDate]);
  autoTable(doc, {
    startY: y,
    head: [['Form', 'Description', 'Status', 'Due Date']],
    body: filingRows,
    theme: 'grid',
    headStyles: { fillColor: [234, 88, 12], fontSize: 8 },
    styles: { fontSize: 7 },
    margin: { left: 14 },
  });
  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 10;

  doc.setFont('helvetica', 'bold');
  doc.text('Payment History', 14, y);
  y += 6;
  const payRows = payments.slice(0, 15).map((p) => [p.date, p.type, `$${p.amount.toLocaleString()}`, String(p.taxYear)]);
  autoTable(doc, {
    startY: y,
    head: [['Date', 'Type', 'Amount', 'Year']],
    body: payRows,
    theme: 'grid',
    headStyles: { fillColor: [234, 88, 12], fontSize: 8 },
    styles: { fontSize: 7 },
    margin: { left: 14 },
  });

  doc.save(`tax-summary-${data.taxYear}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
