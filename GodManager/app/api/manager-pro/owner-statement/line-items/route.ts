import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import {
  canAccessClientId,
  getClientScopeWhere,
  toClientScopeUser,
} from '@/lib/clientScope';
import { recomputeOwnerMonthPayoutTotals } from '@/lib/ownerStatementTotals';
import { normalizeYearMonthForWrite } from '@/lib/pmMonthRef';
import {
  isPayoutClosed,
  STATEMENT_CLOSED_ERROR,
} from '@/lib/statementWriteGuard';
import type { Decimal } from '@prisma/client/runtime/library';

export const dynamic = 'force-dynamic';

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DESC_MAX = 300;

function truncDescription(s: string): string {
  const t = s.trim();
  return t.length > DESC_MAX ? t.slice(0, DESC_MAX) : t;
}

function decToStr(d: Decimal | null): string | null {
  if (d == null) return null;
  return d.toFixed(2);
}

function defaultManualSortOrder(d: Date): number {
  return d.getUTCDate() * 10 + 7;
}

function serializeLineItem(li: {
  id: string;
  lineType: string;
  description: string;
  amount: Decimal;
  source: string;
  sourceRefId: string | null;
  transactionDate: Date | null;
  sortOrder: number;
  createdAt: Date;
}) {
  return {
    id: li.id,
    lineType: li.lineType,
    description: li.description,
    amount: li.amount.toFixed(2),
    source: li.source,
    sourceRefId: li.sourceRefId,
    transactionDate: li.transactionDate?.toISOString() ?? null,
    sortOrder: li.sortOrder,
    createdAt: li.createdAt.toISOString(),
  };
}

function resolveSyncClientId(property: { clientId: string | null }): string | null {
  return property.clientId ?? null;
}

export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const scopeUser = toClientScopeUser(user);
    const url = new URL(req.url);
    const propertyId = (url.searchParams.get('propertyId') || '').trim();
    const yearMonthRaw = (url.searchParams.get('yearMonth') || '').trim();

    if (!propertyId) {
      return NextResponse.json({ ok: false, error: 'propertyId required' }, { status: 400 });
    }
    const yearMonthNorm = normalizeYearMonthForWrite(yearMonthRaw);
    if (!yearMonthNorm || !YEAR_MONTH.test(yearMonthNorm)) {
      return NextResponse.json({ ok: false, error: 'Invalid yearMonth' }, { status: 400 });
    }

    const property = await prisma.property.findFirst({
      where: { id: propertyId, ...getClientScopeWhere(scopeUser) },
      select: {
        id: true,
        code: true,
        clientId: true,
      },
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

    const lineItems = payout
      ? await prisma.statementLineItem.findMany({
          where: { ownerMonthPayoutId: payout.id },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            lineType: true,
            description: true,
            amount: true,
            source: true,
            sourceRefId: true,
            transactionDate: true,
            sortOrder: true,
            createdAt: true,
          },
        })
      : [];

    return NextResponse.json({
      ok: true,
      payout: payout
        ? {
            id: payout.id,
            propertyId: payout.propertyId,
            yearMonth: payout.yearMonth,
            totalIncome: decToStr(payout.totalIncome ?? null),
            totalExpenses: decToStr(payout.totalExpenses ?? null),
            netPayout: decToStr(payout.netPayout ?? null),
            paidAt: payout.paidAt?.toISOString() ?? null,
            paidAmount: decToStr(payout.paidAmount ?? null),
            closedAt: payout.closedAt?.toISOString() ?? null,
            closedBy: payout.closedBy ?? null,
            reopenedAt: payout.reopenedAt?.toISOString() ?? null,
            reopenedBy: payout.reopenedBy ?? null,
            reopenedByName: payout.reopenedByName ?? null,
            lastSentAt: payout.lastSentAt?.toISOString() ?? null,
            clientId: payout.clientId,
          }
        : null,
      lineItems: lineItems.map(serializeLineItem),
    });
  } catch (e) {
    console.error('[GET /api/manager-pro/owner-statement/line-items]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const scopeUser = toClientScopeUser(user);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    const propertyId = typeof body?.propertyId === 'string' ? body.propertyId.trim() : '';
    const yearMonthRaw = typeof body?.yearMonth === 'string' ? body.yearMonth.trim() : '';
    const lineType = typeof body?.lineType === 'string' ? body.lineType.trim().toLowerCase() : '';
    const descriptionRaw = typeof body?.description === 'string' ? body.description : '';

    if (!propertyId) {
      return NextResponse.json({ ok: false, error: 'propertyId required' }, { status: 400 });
    }
    const yearMonthNorm = normalizeYearMonthForWrite(yearMonthRaw);
    if (!yearMonthNorm || !YEAR_MONTH.test(yearMonthNorm)) {
      return NextResponse.json({ ok: false, error: 'Invalid yearMonth' }, { status: 400 });
    }
    if (lineType !== 'income' && lineType !== 'expense') {
      return NextResponse.json({ ok: false, error: 'Invalid lineType' }, { status: 400 });
    }

    const description = truncDescription(descriptionRaw);
    if (!description) {
      return NextResponse.json({ ok: false, error: 'description required' }, { status: 400 });
    }

    const amountNum = Number(body?.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return NextResponse.json({ ok: false, error: 'amount must be a positive number' }, { status: 400 });
    }

    let transactionDate = new Date();
    if (body?.transactionDate != null && body.transactionDate !== '') {
      const d = new Date(String(body.transactionDate));
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ ok: false, error: 'Invalid transactionDate' }, { status: 400 });
      }
      transactionDate = d;
    }

    const sortOrder =
      body?.sortOrder != null && Number.isFinite(Number(body.sortOrder))
        ? Number(body.sortOrder)
        : defaultManualSortOrder(transactionDate);

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
        { ok: false, error: 'Cannot resolve clientId' },
        { status: 400 }
      );
    }

    const existingPayout = await prisma.ownerMonthPayout.findUnique({
      where: {
        propertyId_yearMonth: { propertyId, yearMonth: yearMonthNorm },
      },
      select: { closedAt: true },
    });

    if (isPayoutClosed(existingPayout)) {
      return NextResponse.json(
        { ok: false, error: STATEMENT_CLOSED_ERROR },
        { status: 409 }
      );
    }

    const { lineItem, totals } = await prisma.$transaction(async (tx) => {
      const payout = await tx.ownerMonthPayout.upsert({
        where: {
          propertyId_yearMonth: { propertyId, yearMonth: yearMonthNorm },
        },
        create: {
          propertyId,
          yearMonth: yearMonthNorm,
          clientId: syncClientId,
          totalIncome: new Prisma.Decimal(0),
          totalExpenses: new Prisma.Decimal(0),
          netPayout: new Prisma.Decimal(0),
        },
        update: {
          clientId: syncClientId,
        },
      });

      const created = await tx.statementLineItem.create({
        data: {
          ownerMonthPayoutId: payout.id,
          lineType,
          description,
          amount: amountNum,
          sortOrder,
          clientId: syncClientId,
          source: 'MANUAL',
          sourceRefId: null,
          transactionDate,
        },
        select: {
          id: true,
          lineType: true,
          description: true,
          amount: true,
          source: true,
          sourceRefId: true,
          transactionDate: true,
          sortOrder: true,
          createdAt: true,
        },
      });

      const totals = await recomputeOwnerMonthPayoutTotals(payout.id, tx);

      await tx.auditEntry.create({
        data: {
          actorId: user.id,
          actorEmail: user.email ?? null,
          action: 'owner_statement.line_item.create',
          entity: 'StatementLineItem',
          entityId: created.id,
          clientId: syncClientId,
          details: JSON.stringify({
            ownerMonthPayoutId: payout.id,
            propertyId,
            lineType,
            description,
            amount: amountNum.toFixed(2),
          }),
        },
      });

      return { lineItem: created, totals };
    });

    return NextResponse.json({
      ok: true,
      lineItem: serializeLineItem(lineItem),
      payoutTotals: {
        totalIncome: totals.totalIncome.toFixed(2),
        totalExpenses: totals.totalExpenses.toFixed(2),
        netPayout: totals.netPayout.toFixed(2),
      },
    });
  } catch (e) {
    console.error('[POST /api/manager-pro/owner-statement/line-items]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
