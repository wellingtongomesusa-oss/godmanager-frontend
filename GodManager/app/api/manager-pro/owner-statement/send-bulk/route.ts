import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { toClientScopeUser } from '@/lib/clientScope';
import { sendOwnerStatementForProperty } from '@/lib/ownerStatementEmail';
import { normalizeYearMonthForWrite } from '@/lib/pmMonthRef';

export const dynamic = 'force-dynamic';

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function isStmtAdmin(role: string): boolean {
  return role === 'admin' || role === 'super_admin';
}

export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!isStmtAdmin(user.role)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const yearMonthRaw = typeof body.yearMonth === 'string' ? body.yearMonth.trim() : '';
  const yearMonthNorm = normalizeYearMonthForWrite(yearMonthRaw);

  if (!yearMonthNorm || !YEAR_MONTH.test(yearMonthNorm)) {
    return NextResponse.json({ ok: false, error: 'Invalid yearMonth' }, { status: 400 });
  }

  const onlyClosed = body.onlyClosed === undefined ? true : Boolean(body.onlyClosed);

  const scopeUser = toClientScopeUser(user);

  if (scopeUser.role !== 'super_admin' && !scopeUser.clientId) {
    return NextResponse.json({
      ok: true,
      summary: { totalAttempted: 0, sent: 0, failed: 0 },
      results: [],
    });
  }

  const where: Prisma.OwnerMonthPayoutWhereInput = {
    yearMonth: yearMonthNorm,
    ...(onlyClosed ? { closedAt: { not: null } } : {}),
    ...(scopeUser.role !== 'super_admin' ? { clientId: scopeUser.clientId! } : {}),
  };

  const payouts = await prisma.ownerMonthPayout.findMany({
    where,
    select: {
      propertyId: true,
      property: { select: { code: true } },
    },
  });

  type RowResult = {
    propertyId: string;
    code: string | null;
    status: 'sent' | 'failed';
    error?: string;
  };

  const results: RowResult[] = [];
  let sent = 0;
  let failed = 0;

  for (const p of payouts) {
    const r = await sendOwnerStatementForProperty({
      scopeUser,
      actorId: user.id,
      actorEmail: user.email ?? null,
      propertyId: p.propertyId,
      yearMonthNorm,
    });

    if (r.ok) {
      sent += 1;
      results.push({
        propertyId: p.propertyId,
        code: p.property.code,
        status: 'sent',
      });
    } else {
      failed += 1;
      results.push({
        propertyId: p.propertyId,
        code: p.property.code,
        status: 'failed',
        error: r.error,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    summary: {
      totalAttempted: payouts.length,
      sent,
      failed,
    },
    results,
  });
}
