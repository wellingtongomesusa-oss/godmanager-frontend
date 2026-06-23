import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';
import { normalizeYearMonthForWrite } from '@/lib/pmMonthRef';
import { recomputeOwnerMonthPayoutTotals } from '@/lib/ownerStatementTotals';

export const dynamic = 'force-dynamic';

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function isStmtAdmin(role: string): boolean {
  return role === 'admin' || role === 'super_admin';
}

function userDisplayName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

function payoutsWithMovementWhere(
  yearMonthNorm: string,
  scopeWhere: ReturnType<typeof getClientScopeWhere>,
): Prisma.OwnerMonthPayoutWhereInput {
  return {
    yearMonth: yearMonthNorm,
    ...scopeWhere,
    statementLineItems: { some: {} },
  };
}

export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!isStmtAdmin(user.role)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const yearMonthRaw = typeof body.yearMonth === 'string' ? body.yearMonth.trim() : '';
  const yearMonthNorm = normalizeYearMonthForWrite(yearMonthRaw);
  const dryRun =
    url.searchParams.get('dryRun') === 'true' || body.dryRun === true || body.dryRun === 'true';

  if (!yearMonthNorm || !YEAR_MONTH.test(yearMonthNorm)) {
    return NextResponse.json({ ok: false, error: 'Invalid yearMonth' }, { status: 400 });
  }

  const scopeUser = toClientScopeUser(user);
  const scopeWhere = getClientScopeWhere(scopeUser);
  const where = payoutsWithMovementWhere(yearMonthNorm, scopeWhere);

  const payouts = await prisma.ownerMonthPayout.findMany({
    where,
    select: {
      id: true,
      propertyId: true,
      closedAt: true,
      clientId: true,
    },
  });

  const openPayouts = payouts.filter((p) => !p.closedAt);
  const alreadyClosed = payouts.length - openPayouts.length;

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      yearMonth: yearMonthNorm,
      wouldClose: openPayouts.length,
      alreadyClosed,
      total: payouts.length,
    });
  }

  const userName = userDisplayName(user.firstName, user.lastName);
  const closedAt = new Date();
  const closedPropertyIds: string[] = [];

  // Transação por payout (recompute + close), não uma transação única — evita timeout com muitas props.
  for (const p of openPayouts) {
    await prisma.$transaction(async (tx) => {
      await recomputeOwnerMonthPayoutTotals(p.id, tx);
      await tx.ownerMonthPayout.update({
        where: { id: p.id },
        data: {
          closedAt,
          closedBy: user.id,
          reopenedAt: null,
          reopenedBy: null,
          reopenedByName: null,
        },
      });
    });
    closedPropertyIds.push(p.propertyId);
  }

  if (closedPropertyIds.length > 0) {
    const clientIdAudit =
      scopeUser.clientId ?? user.clientId ?? openPayouts[0]?.clientId ?? null;

    await prisma.auditEntry.create({
      data: {
        actorId: user.id,
        actorEmail: user.email ?? null,
        action: 'owner_statement.close_bulk',
        entity: 'OwnerMonthPayout',
        entityId: yearMonthNorm,
        clientId: clientIdAudit,
        details: JSON.stringify({
          yearMonth: yearMonthNorm,
          userId: user.id,
          userName,
          userEmail: user.email ?? null,
          closedCount: closedPropertyIds.length,
          propertyIds: closedPropertyIds,
        }),
      },
    });
  }

  return NextResponse.json({
    ok: true,
    yearMonth: yearMonthNorm,
    closed: closedPropertyIds.length,
    skippedAlreadyClosed: alreadyClosed,
    total: closedPropertyIds.length + alreadyClosed,
  });
}
