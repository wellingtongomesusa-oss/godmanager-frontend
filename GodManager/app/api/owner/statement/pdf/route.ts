import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import { prisma } from '@/lib/db';
import { StatementPDF } from '@/lib/pdf/StatementPDF';

export const dynamic = 'force-dynamic';

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

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

const fmtUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    n
  );

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const propertyId = url.searchParams.get('propertyId') ?? '';
  const period = url.searchParams.get('period') ?? '';
  const langRaw = (url.searchParams.get('lang') ?? 'pt').toLowerCase();
  const lang: 'pt' | 'en' = langRaw === 'en' ? 'en' : 'pt';

  if (!propertyId || !PERIOD_RE.test(period)) {
    return NextResponse.json(
      { ok: false, error: 'invalid_params' },
      { status: 400 }
    );
  }

  const h = headers();
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host = h.get('host') ?? 'www.godmanager.us';
  const cookie = h.get('cookie') ?? '';

  const dataUrl = new URL(
    `/api/owner/statement?propertyId=${encodeURIComponent(propertyId)}&period=${encodeURIComponent(period)}`,
    `${proto}://${host}`
  );

  const dataRes = await fetch(dataUrl.toString(), {
    headers: { cookie },
    cache: 'no-store',
  });

  if (dataRes.status !== 200) {
    const status =
      dataRes.status === 401 ? 401 : dataRes.status === 403 ? 403 : 404;
    return NextResponse.json(
      { ok: false, error: `upstream_${dataRes.status}` },
      { status }
    );
  }

  const data = await dataRes.json();
  if (!data.ok || !data.payout) {
    return NextResponse.json(
      { ok: false, error: 'no_statement_for_period' },
      { status: 404 }
    );
  }

  const propRow = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { deposit: true },
  });
  const depositValue = propRow?.deposit ? parseFloat(propRow.deposit.toString()) : 0;
  const securityDeposit = fmtUSD(depositValue);

  const now = new Date();
  const statementNumber = `MP-${period}-${data.property.code}`;

  const pdfProps = {
    lang,
    property: {
      code: data.property.code,
      address: data.property.address,
      ownerName: data.property.ownerName,
      securityDeposit,
      clientName: data.property.clientName,
    },
    period: { yearMonth: period, label: periodLabel(period, lang) },
    statementNumber,
    issuedAt: issuedAtLabel(now, lang),
    payout: {
      totalIncome: data.payout.totalIncome,
      totalExpenses: data.payout.totalExpenses,
      netPayout: data.payout.netPayout,
      lineItems: data.payout.lineItems,
    },
  };

  try {
    type PdfDocRoot = Parameters<typeof renderToBuffer>[0];
    const buffer = await renderToBuffer(
      React.createElement(StatementPDF, pdfProps) as PdfDocRoot
    );
    const filename = `${statementNumber}-${lang}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('[GET /api/owner/statement/pdf]', e);
    return NextResponse.json(
      { ok: false, error: 'render_failed' },
      { status: 500 }
    );
  }
}
