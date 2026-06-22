import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { prisma } from '@/lib/db';
import {
  getClientScopeWhere,
  type ClientScopeUser,
} from '@/lib/clientScope';
import { BillPDF } from '@/lib/pdf/BillPDF';
import { validHttpLogoUrl } from '@/lib/pdf/StatementPDF';

const MONTHS_PT = [
  '',
  'Janeiro',
  'Fevereiro',
  'Marco',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];
const MONTHS_EN = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const STATUS_PT: Record<string, string> = {
  DRAFT: 'Rascunho',
  APPROVED: 'Aprovado',
  SENT: 'Enviada',
  PAID: 'Paga',
  CANCELLED: 'Cancelada',
};

const STATUS_EN: Record<string, string> = {
  DRAFT: 'Draft',
  APPROVED: 'Approved',
  SENT: 'Sent',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
};

export type BuildBillPdfCode =
  | 'not_found'
  | 'forbidden'
  | 'not_bill'
  | 'pdf_failed';

export type BuildBillPdfResult =
  | { ok: true; buffer: Buffer; filename: string }
  | { ok: false; code: BuildBillPdfCode; error: string };

function dateLabel(date: Date | null | undefined, lang: 'pt' | 'en'): string {
  if (!date) return '—';
  if (lang === 'pt') {
    const d = date.getUTCDate();
    const m = MONTHS_PT[date.getUTCMonth() + 1];
    const y = date.getUTCFullYear();
    return `${d} de ${m} de ${y}`;
  }
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function decToNum(v: { toString(): string } | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

function safePdfFilename(number: string): string {
  const base = String(number || 'bill')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_');
  return `${base || 'bill'}.pdf`;
}

export async function buildBillPdfBuffer(params: {
  scopeUser: ClientScopeUser;
  documentId: string;
  lang: 'pt' | 'en';
}): Promise<BuildBillPdfResult> {
  const { scopeUser, documentId, lang } = params;

  const doc = await prisma.billingDocument.findFirst({
    where: { id: documentId, ...getClientScopeWhere(scopeUser) },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });

  if (!doc) {
    return { ok: false, code: 'not_found', error: 'Not found' };
  }

  if (doc.docType !== 'BILL') {
    return { ok: false, code: 'not_bill', error: 'Not a bill document' };
  }

  let clientName: string | null = null;
  let logoUrl: string | null = null;
  if (doc.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: doc.clientId },
      select: { companyName: true, logoUrl: true },
    });
    if (client) {
      clientName = client.companyName;
      logoUrl = validHttpLogoUrl(client.logoUrl);
    }
  }

  let approvedByLabel: string | null = null;
  if (doc.approvedByUserId) {
    const approver = await prisma.user.findUnique({
      where: { id: doc.approvedByUserId },
      select: { firstName: true, lastName: true, email: true },
    });
    if (approver) {
      const name = `${approver.firstName ?? ''} ${approver.lastName ?? ''}`.trim();
      approvedByLabel = name || approver.email || doc.approvedByUserId;
    } else {
      approvedByLabel = doc.approvedByUserId;
    }
  }

  const statusKey = String(doc.status || '').toUpperCase();
  const statusMap = lang === 'pt' ? STATUS_PT : STATUS_EN;
  const statusLabel = statusMap[statusKey] ?? doc.status;

  const st = statusKey;
  const approval =
    (st === 'APPROVED' || st === 'PAID') && doc.approvedAt && approvedByLabel
      ? {
          by: approvedByLabel,
          at: dateLabel(doc.approvedAt, lang),
        }
      : null;

  const receiver =
    doc.receiverName || doc.receiverAddress || doc.receiverEmail || doc.receiverPhone
      ? {
          name: doc.receiverName,
          address: doc.receiverAddress,
          email: doc.receiverEmail,
          phone: doc.receiverPhone,
        }
      : null;

  const pdfProps = {
    lang,
    logoUrl,
    clientName,
    number: doc.number,
    statusLabel,
    issueDate: dateLabel(doc.issueDate, lang),
    dueDate: dateLabel(doc.dueDate, lang),
    vendor: {
      name: doc.contactName,
      email: doc.contactEmail,
      phone: doc.contactPhone,
    },
    receiver,
    items: doc.items.map((it) => ({
      description: it.description,
      quantity: decToNum(it.quantity).toString(),
      unitPrice: decToNum(it.unitPrice).toFixed(2),
      lineTotal: decToNum(it.lineTotal).toFixed(2),
    })),
    total: decToNum(doc.total).toFixed(2),
    approval,
    notes: doc.notes,
  };

  try {
    type PdfDocRoot = Parameters<typeof renderToBuffer>[0];
    const buffer = Buffer.from(
      await renderToBuffer(React.createElement(BillPDF, pdfProps) as PdfDocRoot)
    );
    const filename = safePdfFilename(doc.number);
    return { ok: true, buffer, filename };
  } catch (e) {
    console.error('[billPdf] PDF render failed', e);
    return { ok: false, code: 'pdf_failed', error: 'PDF render failed' };
  }
}
