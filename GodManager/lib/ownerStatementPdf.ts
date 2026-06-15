import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  canAccessClientId,
  getClientScopeWhere,
  type ClientScopeUser,
} from '@/lib/clientScope';
import { StatementPDF, validHttpLogoUrl } from '@/lib/pdf/StatementPDF';

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

export type BuildStatementPdfCode =
  | 'property_not_found'
  | 'forbidden'
  | 'no_statement'
  | 'pdf_failed';

export type BuildStatementPdfResult =
  | { ok: true; buffer: Buffer; statementNumber: string; filename: string }
  | { ok: false; code: BuildStatementPdfCode; error: string };

function periodLabel(yearMonth: string, lang: 'pt' | 'en'): string {
  const [, monthStr] = yearMonth.split('-');
  const months = lang === 'pt' ? MONTHS_PT : MONTHS_EN;
  const year = yearMonth.split('-')[0] ?? '';
  return `${months[parseInt(monthStr, 10)]} ${year}`;
}

function issuedAtLabel(date: Date, lang: 'pt' | 'en'): string {
  if (lang === 'pt') {
    const d = date.getDate();
    const m = MONTHS_PT[date.getMonth() + 1];
    const y = date.getFullYear();
    return `${d} de ${m} de ${y}`;
  }
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

/**
 * Builds owner statement PDF bytes (read-only — no DB writes, no email).
 * Data load + pdfProps mirror sendOwnerStatementForProperty (ownerStatementEmail.ts).
 */
export async function buildStatementPdfBuffer(params: {
  scopeUser: ClientScopeUser;
  propertyId: string;
  yearMonth: string;
  lang: 'pt' | 'en';
}): Promise<BuildStatementPdfResult> {
  const { scopeUser, propertyId, yearMonth, lang } = params;

  const property = await prisma.property.findFirst({
    where: { id: propertyId, ...getClientScopeWhere(scopeUser) },
    select: {
      id: true,
      code: true,
      address: true,
      deposit: true,
      ownerName: true,
      clientId: true,
      client: { select: { companyName: true, logoUrl: true } },
    },
  });

  if (!property) {
    return { ok: false, code: 'property_not_found', error: 'Property not found' };
  }
  if (!canAccessClientId(scopeUser, property.clientId)) {
    return { ok: false, code: 'forbidden', error: 'Forbidden' };
  }

  const payout = await prisma.ownerMonthPayout.findUnique({
    where: {
      propertyId_yearMonth: { propertyId, yearMonth },
    },
  });

  if (!payout) {
    return { ok: false, code: 'no_statement', error: 'No statement for this period' };
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

  // Mirror recomputeOwnerMonthPayoutTotals (ownerStatementTotals.ts) — read-only, no DB write.
  let inc = new Prisma.Decimal(0);
  let exp = new Prisma.Decimal(0);
  for (const li of lineItems) {
    if (li.lineType === 'income') inc = inc.add(li.amount);
    else if (li.lineType === 'expense') exp = exp.add(li.amount);
  }
  const net = inc.sub(exp);

  const ti = inc.toFixed(2);
  const te = exp.toFixed(2);
  const tn = net.toFixed(2);

  const pdfLineItems = lineItems.map((li) => ({
    lineType: li.lineType,
    description: li.description,
    amount: li.amount.toFixed(2),
  }));

  const statementNumber = `MP-${yearMonth}-${property.code}`;
  const now = new Date();
  const logoUrl = validHttpLogoUrl(property.client?.logoUrl);

  const pdfProps = {
    lang,
    logoUrl,
    property: {
      code: property.code,
      address: property.address,
      ownerName: property.ownerName,
      securityDeposit,
      clientName: property.client?.companyName ?? null,
    },
    period: { yearMonth, label: periodLabel(yearMonth, lang) },
    statementNumber,
    issuedAt: issuedAtLabel(now, lang),
    payout: {
      totalIncome: ti,
      totalExpenses: te,
      netPayout: tn,
      lineItems: pdfLineItems,
    },
  };

  try {
    type PdfDocRoot = Parameters<typeof renderToBuffer>[0];
    const buffer = Buffer.from(
      await renderToBuffer(
        React.createElement(StatementPDF, pdfProps) as PdfDocRoot
      )
    );
    const filename = `${statementNumber}-${lang}.pdf`;
    return { ok: true, buffer, statementNumber, filename };
  } catch (e) {
    console.error('[ownerStatementPdf] PDF render failed', e);
    return { ok: false, code: 'pdf_failed', error: 'PDF render failed' };
  }
}
