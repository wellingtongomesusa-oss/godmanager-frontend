import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { canAccessClientId, getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';
import { syncOwnerStatementForProperty } from '@/lib/ownerStatementSync';
import { isPayoutClosed, STATEMENT_CLOSED_ERROR } from '@/lib/statementWriteGuard';

export const dynamic = 'force-dynamic';

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

type BulkResultOk = {
  propertyId: string;
  payoutId: string;
  created: number;
  updated: number;
  totalIncome: string;
  totalExpenses: string;
  netPayout: string;
};

type BulkResultErr = {
  propertyId: string;
  error: string;
};

type BulkResult = BulkResultOk | BulkResultErr;

function resolveSyncClientId(property: {
  clientId: string | null;
}): string | null {
  return property.clientId ?? null;
}


export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const scopeUser = toClientScopeUser(user);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    const yearMonth = typeof body?.yearMonth === 'string' ? body.yearMonth.trim() : '';
    if (!YEAR_MONTH.test(yearMonth)) {
      return NextResponse.json({ ok: false, error: 'Invalid yearMonth' }, { status: 400 });
    }

    const allProperties = body?.allProperties === true;
    const propertyId = typeof body?.propertyId === 'string' ? body.propertyId.trim() : '';
    const hasPropertyId = propertyId.length > 0;

    if (allProperties === hasPropertyId) {
      return NextResponse.json(
        { ok: false, error: 'Provide exactly one of propertyId or allProperties: true' },
        { status: 400 }
      );
    }

    if (!allProperties) {
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

      let syncClientId = resolveSyncClientId(property);
      if (!syncClientId && scopeUser.clientId) {
        syncClientId = scopeUser.clientId;
      }
      if (!syncClientId) {
        return NextResponse.json(
          { ok: false, error: 'Cannot resolve clientId for sync' },
          { status: 400 }
        );
      }

      const existingPayout = await prisma.ownerMonthPayout.findUnique({
        where: {
          propertyId_yearMonth: { propertyId: property.id, yearMonth },
        },
        select: { closedAt: true },
      });

      if (isPayoutClosed(existingPayout)) {
        return NextResponse.json(
          { ok: false, error: STATEMENT_CLOSED_ERROR },
          { status: 409 }
        );
      }

      try {
        const r = await syncOwnerStatementForProperty({
          propertyId: property.id,
          yearMonth,
          clientId: syncClientId,
          actorId: user.id,
        });
        const row: BulkResultOk = {
          propertyId: property.id,
          payoutId: r.payoutId ?? '',
          created: r.created,
          updated: r.updated,
          totalIncome: r.totalIncome,
          totalExpenses: r.totalExpenses,
          netPayout: r.netPayout,
        };
        return NextResponse.json({ ok: true, results: [row] satisfies BulkResult[] });
      } catch (e) {
        return NextResponse.json(
          {
            ok: false,
            propertyId: property.id,
            error: e instanceof Error ? e.message : String(e),
          },
          { status: 500 }
        );
      }
    }

    const properties = await prisma.property.findMany({
      where: getClientScopeWhere(scopeUser),
      select: { id: true, clientId: true },
      orderBy: [{ code: 'asc' }],
    });

    const results: BulkResult[] = [];

    for (const prop of properties) {
      let syncClientId = resolveSyncClientId(prop);
      if (!syncClientId && scopeUser.clientId) {
        syncClientId = scopeUser.clientId;
      }
      if (!syncClientId) {
        results.push({
          propertyId: prop.id,
          error: 'Cannot resolve clientId for sync',
        });
        continue;
      }
      if (!canAccessClientId(scopeUser, prop.clientId)) {
        results.push({ propertyId: prop.id, error: 'Forbidden' });
        continue;
      }

      const bulkPayout = await prisma.ownerMonthPayout.findUnique({
        where: {
          propertyId_yearMonth: { propertyId: prop.id, yearMonth },
        },
        select: { closedAt: true },
      });
      if (isPayoutClosed(bulkPayout)) {
        results.push({ propertyId: prop.id, error: STATEMENT_CLOSED_ERROR });
        continue;
      }

      try {
        const r = await syncOwnerStatementForProperty({
          propertyId: prop.id,
          yearMonth,
          clientId: syncClientId,
          actorId: user.id,
        });
        results.push({
          propertyId: prop.id,
          payoutId: r.payoutId ?? '',
          created: r.created,
          updated: r.updated,
          totalIncome: r.totalIncome,
          totalExpenses: r.totalExpenses,
          netPayout: r.netPayout,
        });
      } catch (e) {
        results.push({
          propertyId: prop.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const anyErr = results.some((r): r is BulkResultErr => 'error' in r);
    return NextResponse.json({ ok: true, results }, { status: anyErr ? 207 : 200 });
  } catch (e) {
    console.error('[POST /api/manager-pro/owner-statement/sync]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
