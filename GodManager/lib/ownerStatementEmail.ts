import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  canAccessClientId,
  getClientScopeWhere,
  type ClientScopeUser,
} from '@/lib/clientScope';
import { sendEmail } from '@/lib/email';
import { StatementPDF } from '@/lib/pdf/StatementPDF';
import { recomputeOwnerMonthPayoutTotals } from '@/lib/ownerStatementTotals';

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

const TEST_INBOX = 'w@godmanager.us';

export type OwnerStatementSendCode =
  | 'property_not_found'
  | 'forbidden'
  | 'no_statement'
  | 'no_owner_email'
  | 'pdf_failed'
  | 'email_failed';

export type OwnerStatementSendResult =
  | { ok: true; sentTo: string; ownerEmailReal: string; sentAt: string }
  | { ok: false; code: OwnerStatementSendCode; error: string };

function periodLabel(yearMonth: string): string {
  const [, monthStr] = yearMonth.split('-');
  const year = yearMonth.split('-')[0] ?? '';
  return `${MONTHS_EN[parseInt(monthStr, 10)]} ${year}`;
}

function issuedAtLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function fmtUSD(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(n);
}

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

/** DEV / safety routing: never sends real owners unless production without GM_OWNER_STMT_EMAIL_TEST=1 */
export function ownerStatementEmailUseTestInbox(): boolean {
  if (process.env.GM_OWNER_STMT_EMAIL_TEST === '1') return true;
  if (process.env.GM_OWNER_STMT_EMAIL_TEST === '0') return false;
  return process.env.NODE_ENV !== 'production';
}

function resolveOwnerEmail(property: {
  ownerEmail: string | null;
  owner: { email: string | null } | null;
}): string | null {
  const fromOwner = property.owner?.email?.trim();
  const fromProp = property.ownerEmail?.trim();
  return fromOwner || fromProp || null;
}

function resolveSyncClientId(property: { clientId: string | null }): string | null {
  return property.clientId ?? null;
}

function buildHtmlStatement(params: {
  propertyCode: string;
  propertyAddress: string;
  ownerName: string | null;
  periodLabel: string;
  lineItems: Array<{
    lineType: string;
    description: string;
    amount: Prisma.Decimal;
    transactionDate: Date | null;
    createdAt: Date;
    sortOrder: number;
  }>;
  totalIncome: string;
  totalExpenses: string;
  netPayout: string;
}): string {
  const sorted = [...params.lineItems].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    const ta = (a.transactionDate ?? a.createdAt).getTime();
    const tb = (b.transactionDate ?? b.createdAt).getTime();
    if (ta !== tb) return ta - tb;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  let run = 0;
  const rows = sorted.map((li) => {
    const amt = parseFloat(li.amount.toString());
    const isInc = String(li.lineType).toLowerCase() === 'income';
    const credit = isInc ? fmtUSD(amt) : '';
    const debit = !isInc ? fmtUSD(amt) : '';
    run += isInc ? amt : -amt;
    const d = li.transactionDate ?? li.createdAt;
    const dateStr = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'UTC',
    }).format(d);

    return `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">${escHtml(dateStr)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">${escHtml(li.description)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;color:#0a7a3a">${escHtml(credit || '—')}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;color:#a32020">${escHtml(debit || '—')}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700">${escHtml(fmtUSD(run))}</td>
    </tr>`;
  });

  return `
  <div style="font-family:system-ui,-apple-system,sans-serif;font-size:14px;color:#111827;line-height:1.45">
    <p style="margin:0 0 12px"><strong>${escHtml(params.propertyCode)}</strong> — ${escHtml(params.propertyAddress)}</p>
    <p style="margin:0 0 6px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.06em">Owner statement</p>
    <p style="margin:0 0 18px;font-size:15px">${escHtml(params.periodLabel)}</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:18px;font-size:13px">
      <thead>
        <tr style="background:#f4efe0;color:#6b7280;text-transform:uppercase;font-size:11px">
          <th align="left" style="padding:8px 10px">Date</th>
          <th align="left" style="padding:8px 10px">Description</th>
          <th align="right" style="padding:8px 10px">Credit</th>
          <th align="right" style="padding:8px 10px">Debit</th>
          <th align="right" style="padding:8px 10px">Running total</th>
        </tr>
      </thead>
      <tbody>${rows.join('')}</tbody>
    </table>
    <table style="width:100%;max-width:420px;border-collapse:collapse;font-size:13px;margin-bottom:8px">
      <tr><td style="padding:6px 0"><strong>Total income</strong></td><td align="right">${escHtml(params.totalIncome)}</td></tr>
      <tr><td style="padding:6px 0"><strong>Total expenses</strong></td><td align="right">${escHtml(params.totalExpenses)}</td></tr>
      <tr><td style="padding:10px 0;border-top:2px solid #d4a843"><strong>Net payout</strong></td><td align="right" style="border-top:2px solid #d4a843;font-weight:700">${escHtml(params.netPayout)}</td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#6b7280">Owner: ${escHtml(params.ownerName ?? '—')}</p>
    <p style="margin:12px 0 0;font-size:11px;color:#9ca3af">GodManager — Your finances, handled with precision.</p>
  </div>`;
}

/**
 * Sends the owner statement PDF + HTML summary via Resend.
 * Updates OwnerMonthPayout.lastSentAt on success.
 */
export async function sendOwnerStatementForProperty(params: {
  scopeUser: ClientScopeUser;
  actorId: string;
  actorEmail: string | null;
  propertyId: string;
  yearMonthNorm: string;
}): Promise<OwnerStatementSendResult> {
  const { scopeUser, propertyId, yearMonthNorm } = params;

  const property = await prisma.property.findFirst({
    where: { id: propertyId, ...getClientScopeWhere(scopeUser) },
    select: {
      id: true,
      code: true,
      address: true,
      deposit: true,
      ownerName: true,
      ownerEmail: true,
      clientId: true,
      owner: { select: { email: true } },
      client: { select: { companyName: true } },
    },
  });

  if (!property) {
    return { ok: false, code: 'property_not_found', error: 'Property not found' };
  }
  if (!canAccessClientId(scopeUser, property.clientId)) {
    return { ok: false, code: 'forbidden', error: 'Forbidden' };
  }

  const ownerEmailReal = resolveOwnerEmail(property);
  if (!ownerEmailReal) {
    return {
      ok: false,
      code: 'no_owner_email',
      error: 'Owner email not configured for this property',
    };
  }

  let payout = await prisma.ownerMonthPayout.findUnique({
    where: {
      propertyId_yearMonth: { propertyId, yearMonth: yearMonthNorm },
    },
  });

  if (!payout) {
    return { ok: false, code: 'no_statement', error: 'No statement for this period' };
  }

  await prisma.$transaction(async (tx) => {
    await recomputeOwnerMonthPayoutTotals(payout!.id, tx);
  });

  payout = await prisma.ownerMonthPayout.findUnique({
    where: { id: payout.id },
  });
  if (!payout) {
    return { ok: false, code: 'no_statement', error: 'Payout missing after recompute' };
  }

  const lineItems = await prisma.statementLineItem.findMany({
    where: { ownerMonthPayoutId: payout.id },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      lineType: true,
      description: true,
      amount: true,
      transactionDate: true,
      createdAt: true,
      sortOrder: true,
    },
  });

  const depositValue = property.deposit ? parseFloat(property.deposit.toString()) : 0;
  const securityDeposit = fmtUSD(depositValue);

  const ti = (payout.totalIncome ?? new Prisma.Decimal(0)).toFixed(2);
  const te = (payout.totalExpenses ?? new Prisma.Decimal(0)).toFixed(2);
  const tn = (payout.netPayout ?? new Prisma.Decimal(0)).toFixed(2);

  const pdfLineItems = lineItems.map((li) => ({
    lineType: li.lineType,
    description: li.description,
    amount: li.amount.toFixed(2),
  }));

  const statementNumber = `MP-${yearMonthNorm}-${property.code}`;
  const now = new Date();
  const lang = 'en' as const;

  const pdfProps = {
    lang,
    property: {
      code: property.code,
      address: property.address,
      ownerName: property.ownerName,
      securityDeposit,
      clientName: property.client?.companyName ?? null,
    },
    period: { yearMonth: yearMonthNorm, label: periodLabel(yearMonthNorm) },
    statementNumber,
    issuedAt: issuedAtLabel(now),
    payout: {
      totalIncome: ti,
      totalExpenses: te,
      netPayout: tn,
      lineItems: pdfLineItems,
    },
  };

  let pdfBuf: Buffer;
  try {
    type PdfDocRoot = Parameters<typeof renderToBuffer>[0];
    pdfBuf = Buffer.from(
      await renderToBuffer(
        React.createElement(StatementPDF, pdfProps) as PdfDocRoot
      )
    );
  } catch (e) {
    console.error('[ownerStatementEmail] PDF render failed', e);
    return { ok: false, code: 'pdf_failed', error: 'PDF render failed' };
  }

  const html = buildHtmlStatement({
    propertyCode: property.code,
    propertyAddress: property.address,
    ownerName: property.ownerName,
    periodLabel: periodLabel(yearMonthNorm),
    lineItems,
    totalIncome: fmtUSD(parseFloat(ti)),
    totalExpenses: fmtUSD(parseFloat(te)),
    netPayout: fmtUSD(parseFloat(tn)),
  });

  const useTest = ownerStatementEmailUseTestInbox();
  const sentTo = useTest ? TEST_INBOX : ownerEmailReal;
  const subjectBase = `Owner statement — ${periodLabel(yearMonthNorm)} — ${property.code}`;
  const subject = useTest
    ? `[TEST → owner: ${ownerEmailReal}] ${subjectBase}`
    : subjectBase;

  const mail = await sendEmail({
    to: sentTo,
    subject,
    html,
    attachments: [{ filename: `${statementNumber}.pdf`, content: pdfBuf }],
  });

  if (!mail.ok) {
    return {
      ok: false,
      code: 'email_failed',
      error: mail.error ?? 'Email send failed',
    };
  }

  const sentAt = new Date();
  await prisma.ownerMonthPayout.update({
    where: { id: payout.id },
    data: { lastSentAt: sentAt },
  });

  await prisma.auditEntry.create({
    data: {
      actorId: params.actorId,
      actorEmail: params.actorEmail ?? null,
      action: 'owner_statement.email.sent',
      entity: 'OwnerMonthPayout',
      entityId: payout.id,
      clientId: property.clientId,
      details: JSON.stringify({
        propertyId,
        yearMonth: yearMonthNorm,
        sentTo,
        ownerEmailReal,
        testMode: useTest,
      }),
    },
  });

  return {
    ok: true,
    sentTo,
    ownerEmailReal,
    sentAt: sentAt.toISOString(),
  };
}

export async function ensureOwnerMonthPayoutWithClient(params: {
  scopeUser: ClientScopeUser;
  propertyId: string;
  yearMonthNorm: string;
}): Promise<
  | { ok: true; payoutId: string; syncClientId: string }
  | { ok: false; error: string }
> {
  const property = await prisma.property.findFirst({
    where: { id: params.propertyId, ...getClientScopeWhere(params.scopeUser) },
    select: { id: true, clientId: true },
  });
  if (!property) {
    return { ok: false, error: 'Property not found' };
  }
  if (!canAccessClientId(params.scopeUser, property.clientId)) {
    return { ok: false, error: 'Forbidden' };
  }

  let syncClientId = resolveSyncClientId(property);
  if (!syncClientId && params.scopeUser.clientId) {
    syncClientId = params.scopeUser.clientId;
  }
  if (!syncClientId) {
    return { ok: false, error: 'Cannot resolve clientId' };
  }

  const payout = await prisma.ownerMonthPayout.upsert({
    where: {
      propertyId_yearMonth: {
        propertyId: params.propertyId,
        yearMonth: params.yearMonthNorm,
      },
    },
    create: {
      propertyId: params.propertyId,
      yearMonth: params.yearMonthNorm,
      clientId: syncClientId,
      totalIncome: new Prisma.Decimal(0),
      totalExpenses: new Prisma.Decimal(0),
      netPayout: new Prisma.Decimal(0),
    },
    update: {
      clientId: syncClientId,
    },
    select: { id: true },
  });

  return { ok: true, payoutId: payout.id, syncClientId };
}
