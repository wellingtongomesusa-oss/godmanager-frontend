import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import {
  canAccessClientId,
  toClientScopeUser,
} from '@/lib/clientScope';
import { recomputeOwnerMonthPayoutTotals } from '@/lib/ownerStatementTotals';

export const dynamic = 'force-dynamic';

const DESC_MAX = 300;

const AUTO_FORBIDDEN = NextResponse.json(
  {
    ok: false,
    error: 'cannot_edit_auto_lineitem',
    message:
      'Line items from automatic sync cannot be edited directly. Edit the source TenantPayment or PmExpense and rerun sync.',
  },
  { status: 403 }
);

function truncDescription(s: string): string {
  const t = s.trim();
  return t.length > DESC_MAX ? t.slice(0, DESC_MAX) : t;
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

async function loadScopedLine(id: string) {
  const li = await prisma.statementLineItem.findUnique({
    where: { id },
    include: {
      ownerMonthPayout: {
        include: { property: true },
      },
    },
  });
  return li;
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const params = await Promise.resolve(ctx.params);
  const id = params?.id?.trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: 'Invalid id' }, { status: 400 });
  }

  try {
    const scopeUser = toClientScopeUser(user);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    const li = await loadScopedLine(id);
    if (!li) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    const property = li.ownerMonthPayout.property;
    if (!property || !canAccessClientId(scopeUser, property.clientId)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    if (li.source !== 'MANUAL' && li.source !== 'CSV_UPLOAD') {
      return AUTO_FORBIDDEN;
    }

    const patch: Record<string, unknown> = {};

    if (body?.lineType !== undefined) {
      const lt = String(body.lineType).trim().toLowerCase();
      if (lt !== 'income' && lt !== 'expense') {
        return NextResponse.json({ ok: false, error: 'Invalid lineType' }, { status: 400 });
      }
      patch.lineType = lt;
    }

    if (body?.description !== undefined) {
      const d = truncDescription(String(body.description));
      if (!d) {
        return NextResponse.json({ ok: false, error: 'description invalid' }, { status: 400 });
      }
      patch.description = d;
    }

    if (body?.amount !== undefined) {
      const n = Number(body.amount);
      if (!Number.isFinite(n) || n <= 0) {
        return NextResponse.json({ ok: false, error: 'amount must be positive' }, { status: 400 });
      }
      patch.amount = n;
    }

    if (body?.transactionDate !== undefined && body.transactionDate !== null && body.transactionDate !== '') {
      const d = new Date(String(body.transactionDate));
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ ok: false, error: 'Invalid transactionDate' }, { status: 400 });
      }
      patch.transactionDate = d;
    } else if (body?.transactionDate === null) {
      patch.transactionDate = null;
    }

    if (body?.sortOrder !== undefined) {
      const so = Number(body.sortOrder);
      if (!Number.isFinite(so)) {
        return NextResponse.json({ ok: false, error: 'Invalid sortOrder' }, { status: 400 });
      }
      patch.sortOrder = Math.trunc(so);
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: 'No fields to update' }, { status: 400 });
    }

    const clientIdAudit =
      li.clientId ?? li.ownerMonthPayout.clientId ?? property.clientId ?? user.clientId ?? null;

    const updateData: Prisma.StatementLineItemUpdateInput = {};
    if (patch.lineType !== undefined) updateData.lineType = patch.lineType as string;
    if (patch.description !== undefined) updateData.description = patch.description as string;
    if (patch.amount !== undefined)
      updateData.amount = new Prisma.Decimal(Number(patch.amount));
    if (patch.transactionDate !== undefined)
      updateData.transactionDate =
        patch.transactionDate === null ? null : (patch.transactionDate as Date);
    if (patch.sortOrder !== undefined) updateData.sortOrder = patch.sortOrder as number;

    const { updated, totals } = await prisma.$transaction(async (tx) => {
      const upd = await tx.statementLineItem.update({
        where: { id: li.id },
        data: updateData,
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

      const totals = await recomputeOwnerMonthPayoutTotals(li.ownerMonthPayout.id, tx);

      await tx.auditEntry.create({
        data: {
          actorId: user.id,
          actorEmail: user.email ?? null,
          action: 'owner_statement.line_item.update',
          entity: 'StatementLineItem',
          entityId: upd.id,
          clientId: clientIdAudit,
          details: JSON.stringify({ patch }),
        },
      });

      return { updated: upd, totals };
    });

    return NextResponse.json({
      ok: true,
      lineItem: serializeLineItem(updated),
      payoutTotals: {
        totalIncome: totals.totalIncome.toFixed(2),
        totalExpenses: totals.totalExpenses.toFixed(2),
        netPayout: totals.netPayout.toFixed(2),
      },
    });
  } catch (e) {
    console.error('[PATCH /api/manager-pro/owner-statement/line-items/[id]]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const params = await Promise.resolve(ctx.params);
  const id = params?.id?.trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: 'Invalid id' }, { status: 400 });
  }

  try {
    const scopeUser = toClientScopeUser(user);

    const li = await loadScopedLine(id);
    if (!li) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    const property = li.ownerMonthPayout.property;
    if (!property || !canAccessClientId(scopeUser, property.clientId)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    if (li.source !== 'MANUAL' && li.source !== 'CSV_UPLOAD') {
      return AUTO_FORBIDDEN;
    }

    const clientIdAudit =
      li.clientId ?? li.ownerMonthPayout.clientId ?? property.clientId ?? user.clientId ?? null;

    const totals = await prisma.$transaction(async (tx) => {
      await tx.statementLineItem.delete({ where: { id: li.id } });
      const t = await recomputeOwnerMonthPayoutTotals(li.ownerMonthPayout.id, tx);

      await tx.auditEntry.create({
        data: {
          actorId: user.id,
          actorEmail: user.email ?? null,
          action: 'owner_statement.line_item.delete',
          entity: 'StatementLineItem',
          entityId: li.id,
          clientId: clientIdAudit,
          details: JSON.stringify({
            ownerMonthPayoutId: li.ownerMonthPayout.id,
            payoutId: li.ownerMonthPayout.id,
          }),
        },
      });

      return t;
    });

    return NextResponse.json({
      ok: true,
      payoutTotals: {
        totalIncome: totals.totalIncome.toFixed(2),
        totalExpenses: totals.totalExpenses.toFixed(2),
        netPayout: totals.netPayout.toFixed(2),
      },
    });
  } catch (e) {
    console.error('[DELETE /api/manager-pro/owner-statement/line-items/[id]]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
