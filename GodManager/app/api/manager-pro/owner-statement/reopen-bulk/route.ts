import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';
import { normalizeYearMonthForWrite } from '@/lib/pmMonthRef';

export const dynamic = 'force-dynamic';

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function userDisplayName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const yearMonthRaw = typeof body.yearMonth === 'string' ? body.yearMonth.trim() : '';
  const yearMonthNorm = normalizeYearMonthForWrite(yearMonthRaw);

  if (!yearMonthNorm || !YEAR_MONTH.test(yearMonthNorm)) {
    return NextResponse.json({ ok: false, error: 'Invalid yearMonth' }, { status: 400 });
  }

  const scopeUser = toClientScopeUser(user);
  const scopeWhere = getClientScopeWhere(scopeUser);

  const where: Prisma.OwnerMonthPayoutWhereInput = {
    yearMonth: yearMonthNorm,
    closedAt: { not: null },
    ...scopeWhere,
  };

  const payouts = await prisma.ownerMonthPayout.findMany({
    where,
    select: {
      id: true,
      propertyId: true,
      clientId: true,
    },
  });

  if (payouts.length === 0) {
    return NextResponse.json({
      ok: true,
      yearMonth: yearMonthNorm,
      reopened: 0,
    });
  }

  const userName = userDisplayName(user.firstName, user.lastName);
  const reopenedAt = new Date();
  const propertyIds: string[] = [];

  // Update por payout (sem transação única) — escala melhor com muitas props.
  for (const p of payouts) {
    await prisma.ownerMonthPayout.update({
      where: { id: p.id },
      data: {
        closedAt: null,
        closedBy: null,
        reopenedAt,
        reopenedBy: user.id,
        reopenedByName: userName,
      },
    });
    propertyIds.push(p.propertyId);
  }

  const clientIdAudit =
    scopeUser.clientId ?? user.clientId ?? payouts[0]?.clientId ?? null;

  await prisma.auditEntry.create({
    data: {
      actorId: user.id,
      actorEmail: user.email ?? null,
      action: 'owner_statement.reopen_bulk',
      entity: 'OwnerMonthPayout',
      entityId: yearMonthNorm,
      clientId: clientIdAudit,
      details: JSON.stringify({
        yearMonth: yearMonthNorm,
        userId: user.id,
        userName,
        userEmail: user.email ?? null,
        reopenedCount: propertyIds.length,
        propertyIds,
      }),
    },
  });

  return NextResponse.json({
    ok: true,
    yearMonth: yearMonthNorm,
    reopened: propertyIds.length,
  });
}
