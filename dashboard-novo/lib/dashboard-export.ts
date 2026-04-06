/**
 * Dashboard export – CSV e PDF do resumo do dashboard (KPIs + transações).
 * Execute `npm install` para resolver "Module not found: jspdf".
 */

import { getMetrics, getTransactions, getDashboardKpis } from '@/services/admin/admin-dashboard.service';
import { downloadCsv } from '@/lib/csv-export';
// @ts-ignore — jspdf
import { jsPDF } from 'jspdf';
// @ts-ignore — jspdf-autotable
import autoTable from 'jspdf-autotable';

function getExportData(): { kpis: { label: string; value: number | string }[]; transactions: Record<string, string | number>[] } {
  const metrics = getMetrics();
  const kpis = getDashboardKpis(metrics).map((k) => ({ label: k.label, value: k.value }));
  const tx = getTransactions({});
  const rows = tx.slice(0, 50).map((t) => ({
    id: t.id,
    cliente: t.cliente,
    tipo: t.tipoDemanda,
    data: t.data,
    valor: t.valor ?? '',
    status: t.status,
  }));
  return { kpis, transactions: rows };
}

export function exportDashboardCsv(): void {
  const { kpis, transactions } = getExportData();
  const kpiRows = kpis.map((k) => ({ Type: 'KPI', Label: k.label, Value: String(k.value), ID: '', Client: '', DemandType: '', Date: '', Amount: '', Status: '' }));
  const txRows = transactions.map((t) => ({ Type: 'Transaction', Label: '', Value: '', ID: String(t.id), Client: String(t.cliente), DemandType: String(t.tipo), Date: String(t.data), Amount: String(t.valor), Status: String(t.status) }));
  const data = [...kpiRows, ...txRows];
  downloadCsv(data, `dashboard-export-${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportDashboardPdf(): void {
  const { kpis, transactions } = getExportData();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  let y = 18;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Dashboard Export', 14, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date().toISOString().slice(0, 19).replace('T', ' '), 14, y);
  y += 12;

  doc.setFont('helvetica', 'bold');
  doc.text('KPIs', 14, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Value']],
    body: kpis.map((k) => [k.label, String(k.value)]),
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
    styles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: w - 80 - 28 } },
    margin: { left: 14 },
  });
  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 10;

  if (transactions.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Recent Transactions (sample)', 14, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [['ID', 'Client', 'Type', 'Date', 'Value', 'Status']],
      body: transactions.map((t) => [
        String(t.id),
        String(t.cliente),
        String(t.tipo),
        String(t.data),
        String(t.valor),
        String(t.status),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
      styles: { fontSize: 7 },
      margin: { left: 14 },
    });
  }

  doc.save(`dashboard-export-${new Date().toISOString().slice(0, 10)}.pdf`);
}
