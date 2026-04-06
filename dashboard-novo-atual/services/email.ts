/**
 * E-mail service – dashboard-novo
 * Mock: simula envio de invoice/GAAP por e-mail. Trocar por API (Resend, SendGrid, etc.) em produção.
 */

import type { Invoice } from '@/services/invoices/invoices.service';
import type { GaapReport } from '@/services/gaap.service';
import { getMonthName } from '@/services/gaap.service';

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export type SendInvoiceEmailResult = SendEmailResult;

const DEFAULT_INVOICE_MESSAGE = (inv: Invoice) =>
  `Prezado(a),\n\nSegue em anexo a Invoice ${inv.number} referente aos nossos serviços.\n\nValor total: ${inv.currency} ${inv.total.toFixed(2)}\nVencimento: ${inv.dueDate}\n\nEm caso de dúvidas, entre em contato.\n\nAtenciosamente,\n${inv.company.name}`;

/**
 * Simula envio de invoice por e-mail (PDF em anexo).
 */
export async function sendInvoiceEmail(
  invoice: Invoice,
  to: string,
  subject?: string,
  body?: string
): Promise<SendInvoiceEmailResult> {
  if (!to?.trim()) {
    return { success: false, error: 'E-mail do destinatário é obrigatório.' };
  }
  const subj = subject ?? `Invoice ${invoice.number} – ${invoice.company.name}`;
  const text = body ?? DEFAULT_INVOICE_MESSAGE(invoice);
  try {
    await new Promise((r) => setTimeout(r, 800));
    return { success: true, messageId: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Erro ao enviar e-mail.',
    };
  }
}

const DEFAULT_GAAP_MESSAGE = (r: GaapReport) =>
  `Dear Client,\n\nPlease find attached the GAAP Monthly Report for ${getMonthName(r.period.month)} ${r.period.year}.\n\nClient: ${r.client.clientName}\nPeriod: ${r.period.periodStart} to ${r.period.periodEnd}\n\nBest regards.`;

/**
 * Simula envio de relatório GAAP por e-mail (PDF em anexo).
 */
export async function sendGaapReportEmail(
  report: GaapReport,
  to: string,
  subject?: string,
  body?: string
): Promise<SendEmailResult> {
  if (!to?.trim()) {
    return { success: false, error: 'E-mail do destinatário é obrigatório.' };
  }
  const subj = subject ?? `GAAP Monthly Report – ${getMonthName(report.period.month)} ${report.period.year}`;
  const text = body ?? DEFAULT_GAAP_MESSAGE(report);
  try {
    await new Promise((r) => setTimeout(r, 800));
    return { success: true, messageId: `mock-gaap-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Erro ao enviar e-mail.',
    };
  }
}

/**
 * Simula envio de relatório A/P por e-mail (PDF em anexo).
 */
export async function sendApReportEmail(
  to: string,
  subject?: string,
  summary?: string
): Promise<SendEmailResult> {
  if (!to?.trim()) {
    return { success: false, error: 'E-mail do destinatário é obrigatório.' };
  }
  const subj = subject ?? 'A/P Report – Accounts Payable';
  const text = summary ?? `Please find attached the A/P Report generated on ${new Date().toISOString().slice(0, 10)}.`;
  try {
    await new Promise((r) => setTimeout(r, 600));
    return { success: true, messageId: `mock-ap-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Erro ao enviar e-mail.',
    };
  }
}
