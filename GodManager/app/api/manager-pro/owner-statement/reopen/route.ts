import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import {
  canAccessClientId,
  getClientScopeWhere,
  toClientScopeUser,
} from '@/lib/clientScope';
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
  const propertyId = typeof body.propertyId === 'string' ? body.propertyId.trim() : '';
  const yearMonthRaw = typeof body.yearMonth === 'string' ? body.yearMonth.trim() : '';
  const yearMonthNorm = normalizeYearMonthForWrite(yearMonthRaw);

  if (!propertyId || !yearMonthNorm || !YEAR_MONTH.test(yearMonthNorm)) {
    return NextResponse.json({ ok: false, error: 'Invalid propertyId or yearMonth' }, { status: 400 });
  }

  const scopeUser = toClientScopeUser(user);

  const property = await prisma.property.findFirst({
    where: { id: propertyId, ...getClientScopeWhere(scopeUser) },
    select: { id: true, clientId: true },
  });
  if (!property) {
    return NextResponse.json({ ok: false, error: 'Property not found' }, { status: 404 });
  }
  if (!canAccessClientId(scopeUser, property.clientId)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const payout = await prisma.ownerMonthPayout.findUnique({
    where: {
      propertyId_yearMonth: { propertyId, yearMonth: yearMonthNorm },
    },
  });

  if (!payout) {
    return NextResponse.json({ ok: false, error: 'Payout not found' }, { status: 404 });
  }

  if (!payout.closedAt) {
    return NextResponse.json({ ok: false, error: 'already_open' }, { status: 400 });
  }

  const userName = userDisplayName(user.firstName, user.lastName);
  const clientIdAudit =
    payout.clientId ?? property.clientId ?? scopeUser.clientId ?? user.clientId ?? null;

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.ownerMonthPayout.update({
      where: { id: payout.id },
      data: {
        closedAt: null,
        closedBy: null,
        reopenedAt: new Date(),
        reopenedBy: user.id,
        reopenedByName: userName,
      },
      select: {
        id: true,
        propertyId: true,
        yearMonth: true,
        closedAt: true,
        closedBy: true,
        reopenedAt: true,
        reopenedBy: true,
        reopenedByName: true,
        totalIncome: true,
        totalExpenses: true,
        netPayout: true,
      },
    });

    await tx.auditEntry.create({
      data: {
        actorId: user.id,
        actorEmail: user.email ?? null,
        action: 'owner_statement.reopen',
        entity: 'OwnerMonthPayout',
        entityId: row.id,
        clientId: clientIdAudit,
        details: JSON.stringify({
          userId: user.id,
          userName,
          userEmail: user.email ?? null,
          propertyId,
          yearMonth: yearMonthNorm,
        }),
      },
    });

    return row;
  });

  return NextResponse.json({
    ok: true,
    payout: {
      id: updated.id,
      propertyId: updated.propertyId,
      yearMonth: updated.yearMonth,
      closedAt: updated.closedAt?.toISOString() ?? null,
      closedBy: updated.closedBy ?? null,
      reopenedAt: updated.reopenedAt?.toISOString() ?? null,
      reopenedBy: updated.reopenedBy ?? null,
      reopenedByName: updated.reopenedByName ?? null,
      totalIncome: updated.totalIncome?.toFixed(2) ?? '0.00',
      totalExpenses: updated.totalExpenses?.toFixed(2) ?? '0.00',
      netPayout: updated.netPayout?.toFixed(2) ?? '0.00',
    },
  });
}
