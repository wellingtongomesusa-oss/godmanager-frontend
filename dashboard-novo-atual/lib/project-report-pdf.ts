/**
 * Project Report PDF – relatório do projeto em andamento (jspdf).
 */

import type { Project } from '@/services/project.service';
import type { ProjectFileRecord } from '@/services/project-files.service';
// @ts-ignore — jspdf
import { jsPDF } from 'jspdf';
// @ts-ignore — jspdf-autotable
import autoTable from 'jspdf-autotable';

export function generateProjectReportPdf(project: Project, files: ProjectFileRecord[] = []): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  let y = 18;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório do Projeto', 14, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date().toISOString().slice(0, 19).replace('T', ' '), 14, y);
  y += 12;

  doc.setFont('helvetica', 'bold');
  doc.text('Informações Gerais', 14, y);
  y += 6;
  const infoRows = [
    ['Nome do Projeto', project.name],
    ['Cliente', project.clientName],
    ['Data de início', project.startDate],
    ['Status', project.status],
  ];
  autoTable(doc, {
    startY: y,
    head: [['Campo', 'Valor']],
    body: infoRows,
    theme: 'grid',
    headStyles: { fillColor: [234, 88, 12], fontSize: 9 },
    styles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: w - 50 - 28 } },
    margin: { left: 14 },
  });
  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 10;

  doc.setFont('helvetica', 'bold');
  doc.text('Estrutura Financeira', 14, y);
  y += 6;
  const financeRows = [
    ['Valor de entrada', `R$ ${project.downPayment.toLocaleString('pt-BR')}`],
    ['Pagamento mensal', `R$ ${project.monthlyPayment.toLocaleString('pt-BR')}`],
    ['Número de parcelas', String(project.numberOfInstallments)],
    ['Valor total do projeto', `R$ ${project.totalValue.toLocaleString('pt-BR')}`],
  ];
  autoTable(doc, {
    startY: y,
    head: [['Campo', 'Valor']],
    body: financeRows,
    theme: 'grid',
    headStyles: { fillColor: [234, 88, 12], fontSize: 9 },
    styles: { fontSize: 9 },
    margin: { left: 14 },
  });
  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 10;

  if (project.notes) {
    doc.setFont('helvetica', 'bold');
    doc.text('Notas', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(project.notes, 14, y, { maxWidth: w - 28 });
    y += 12;
  }

  if (files.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Arquivos anexados', 14, y);
    y += 6;
    const fileRows = files.map((f) => [f.fileName, f.type, f.uploadedAt.slice(0, 10), `${(f.fileSize / 1024).toFixed(1)} KB`]);
    autoTable(doc, {
      startY: y,
      head: [['Arquivo', 'Tipo', 'Data', 'Tamanho']],
      body: fileRows,
      theme: 'grid',
      headStyles: { fillColor: [234, 88, 12], fontSize: 8 },
      styles: { fontSize: 7 },
      margin: { left: 14 },
    });
  }

  doc.save(`projeto-${project.id}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
