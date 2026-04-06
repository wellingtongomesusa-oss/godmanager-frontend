/**
 * GAAP Report PDF – geração de PDF para relatórios GAAP mensais (jspdf + jspdf-autotable).
 * Execute `npm install` para resolver "Module not found: jspdf".
 */

// @ts-ignore — jspdf
import { jsPDF } from 'jspdf';
// @ts-ignore — jspdf-autotable
import autoTable from 'jspdf-autotable';
import type { GaapReport } from '@/services/gaap.service';
import { getMonthName } from '@/services/gaap.service';

const FONT = 'helvetica';
const TITLE = 16;
const NORMAL = 10;
const SMALL = 9;

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function generateGaapReportPdf(report: GaapReport): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  let y = 18;

  doc.setFontSize(TITLE);
  doc.setFont(FONT, 'bold');
  doc.text('GAAP Monthly Report', 14, y);
  y += 6;
  doc.setFontSize(SMALL);
  doc.setFont(FONT, 'normal');
  doc.text('Financial Reporting under U.S. Generally Accepted Accounting Principles', 14, y);
  y += 14;

  const { client, period, revenue, expenses, assets, liabilities, equity, compliance, finalization } = report;

  const sections: [string, [string, string][]][] = [
    ['1. CLIENT INFORMATION', [
      ['Client Name', client.clientName],
      ['Business Name', client.businessName],
      ['EIN / SSN', client.einOrSsn],
      ['Address', client.address],
      ['Country', client.country],
      ['Email', client.email],
      ['Phone', client.phone],
      ['Account Creation Date', client.accountCreationDate],
      ['Last Update Date', client.lastUpdateDate],
    ]],
    ['2. REPORTING PERIOD', [
      ['Reporting Month', getMonthName(period.month)],
      ['Reporting Year', String(period.year)],
      ['Period Start', period.periodStart],
      ['Period End', period.periodEnd],
    ]],
    ['3. REVENUE', [
      ['Gross Revenue', fmt(revenue.grossRevenue)],
      ['Adjusted Revenue', fmt(revenue.adjustedRevenue)],
      ['Deferred Revenue', fmt(revenue.deferredRevenue)],
      ['Notes', revenue.notes || '—'],
    ]],
    ['4. EXPENSES', [
      ['Operating Expenses', fmt(expenses.operatingExpenses)],
      ['Payroll Expenses', fmt(expenses.payrollExpenses)],
      ['Administrative Expenses', fmt(expenses.administrativeExpenses)],
      ['Marketing Expenses', fmt(expenses.marketingExpenses)],
      ['Depreciation & Amortization', fmt(expenses.depreciationAmortization)],
      ['Other Expenses', fmt(expenses.otherExpenses)],
      ['Notes', expenses.notes || '—'],
    ]],
    ['5. ASSETS', [
      ['Current Assets', fmt(assets.currentAssets)],
      ['Fixed Assets', fmt(assets.fixedAssets)],
      ['Intangible Assets', fmt(assets.intangibleAssets)],
      ['Accumulated Depreciation', fmt(assets.accumulatedDepreciation)],
      ['Notes', assets.notes || '—'],
    ]],
    ['6. LIABILITIES', [
      ['Current Liabilities', fmt(liabilities.currentLiabilities)],
      ['Long-term Liabilities', fmt(liabilities.longTermLiabilities)],
      ['Accounts Payable', fmt(liabilities.accountsPayable)],
      ['Notes Payable', fmt(liabilities.notesPayable)],
      ['Other Liabilities', fmt(liabilities.otherLiabilities)],
      ['Notes', liabilities.notes || '—'],
    ]],
    ['7. EQUITY', [
      ["Owner's Equity", fmt(equity.ownersEquity)],
      ['Retained Earnings', fmt(equity.retainedEarnings)],
      ['Capital Contributions', fmt(equity.capitalContributions)],
      ['Withdrawals', fmt(equity.withdrawals)],
      ['Notes', equity.notes || '—'],
    ]],
    ['8. GAAP COMPLIANCE CHECKLIST', [
      ['Revenue Recognition (ASC 606)', compliance.revenueRecognitionAsc606 ? 'Yes' : 'No'],
      ['Expense Matching Principle', compliance.expenseMatchingPrinciple ? 'Yes' : 'No'],
      ['Full Disclosure Principle', compliance.fullDisclosurePrinciple ? 'Yes' : 'No'],
      ['Materiality Principle', compliance.materialityPrinciple ? 'Yes' : 'No'],
      ['Consistency Principle', compliance.consistencyPrinciple ? 'Yes' : 'No'],
      ['Conservatism Principle', compliance.conservatismPrinciple ? 'Yes' : 'No'],
    ]],
    ['9. FINALIZATION', [
      ['Prepared By', finalization.preparedBy],
      ['Reviewed By', finalization.reviewedBy],
      ['Approval Status', finalization.approvalStatus],
      ['Notes', finalization.notes || '—'],
    ]],
  ];

  for (const [title, rows] of sections) {
    if (y > 260) {
      doc.addPage();
      y = 18;
    }
    doc.setFontSize(NORMAL);
    doc.setFont(FONT, 'bold');
    doc.text(title, 14, y);
    y += 6;
    doc.setFont(FONT, 'normal');
    doc.setFontSize(SMALL);
    autoTable(doc, {
      startY: y,
      head: [['Field', 'Value']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
      styles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: w - 55 - 28 } },
      margin: { left: 14 },
    });
    y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8;
  }

  return doc;
}

export function downloadGaapReportPdf(report: GaapReport, filename?: string): void {
  const doc = generateGaapReportPdf(report);
  const name = filename ?? `gaap-report-${report.period.year}-${String(report.period.month).padStart(2, '0')}.pdf`;
  doc.save(name);
}

export function getGaapReportPdfBlob(report: GaapReport): Blob {
  const doc = generateGaapReportPdf(report);
  return doc.output('blob');
}
