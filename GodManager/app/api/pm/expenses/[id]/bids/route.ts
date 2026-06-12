import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';
import { recordAudit } from '@/lib/auditServer';
import { FollowUpMergeError, mergeFollowUpMetadata } from '@/lib/jobFollowUp';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const INVITE_ROLES = new Set(['super_admin', 'admin', 'manager', 'supervisor', 'supervisor_2']);

function parseVendorIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const id = String(item ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function clampDeadlineHours(raw: unknown): number {
  const n = Number(raw);
  const h = Number.isFinite(n) ? Math.floor(n) : 24;
  return Math.min(168, Math.max(1, h));
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const role = String(user.role || '').toLowerCase();
  if (!INVITE_ROLES.has(role)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const expenseId = String(params.id || '').trim();
  if (!expenseId) {
    return NextResponse.json({ ok: false, error: 'Invalid expense id' }, { status: 400 });
  }

  try {
    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
    }

    const vendorIds = parseVendorIds((body as { vendorIds?: unknown }).vendorIds);
    if (vendorIds.length < 1 || vendorIds.length > 3) {
      return NextResponse.json({ ok: false, error: 'selecione de 1 a 3 vendors' }, { status: 400 });
    }

    const deadlineHours = clampDeadlineHours((body as { deadlineHours?: unknown }).deadlineHours);

    const scopeUser = toClientScopeUser(user);
    const expense = await prisma.pmExpense.findFirst({
      where: { id: expenseId, ...getClientScopeWhere(scopeUser) },
      select: { id: true, clientId: true, metadata: true },
    });
    if (!expense) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    const vendors = await prisma.pmVendor.findMany({
      where: { id: { in: vendorIds }, ...getClientScopeWhere(scopeUser) },
      select: { id: true },
    });
    const validVendorIds = vendors.map((v) => v.id);
    if (validVendorIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'Nenhum vendor válido no escopo do cliente' }, { status: 400 });
    }

    const now = new Date();
    const deadline = new Date(now.getTime() + deadlineHours * 60 * 60 * 1000);
    const invitedAtIso = now.toISOString();
    const auditBy = String(user.email || user.id || 'unknown').trim();

    let nextMetadata: Record<string, unknown>;
    try {
      const mergedFollowUp = mergeFollowUpMetadata(
        expense.metadata,
        { stage: 'bidding', queue: 'supervisor' },
        { by: auditBy, at: invitedAtIso },
      );
      nextMetadata = {
        ...mergedFollowUp,
        rfq: {
          invitedAt: invitedAtIso,
          deadline: deadline.toISOString(),
          vendorIds: validVendorIds,
        },
      };
    } catch (e) {
      if (e instanceof FollowUpMergeError) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
      }
      throw e;
    }

    const bids = await prisma.$transaction(async (tx) => {
      const rows: Array<{
        id: string;
        vendorId: string;
        status: string;
        deadline: Date;
      }> = [];

      for (const vendorId of validVendorIds) {
        const bid = await tx.jobBid.upsert({
          where: { expenseId_vendorId: { expenseId, vendorId } },
          create: {
            expenseId,
            vendorId,
            clientId: expense.clientId,
            invitedById: user.id,
            invitedAt: now,
            deadline,
            status: 'invited',
          },
          update: {},
        });
        rows.push(bid);
      }

      await tx.pmExpense.update({
        where: { id: expenseId },
        data: { metadata: nextMetadata as Prisma.InputJsonValue },
      });

      return rows;
    });

    await recordAudit({
      request: req,
      actor: { id: user.id, email: user.email },
      action: 'job_bid.invite',
      entity: 'pm_expense',
      entityId: expenseId,
      details: JSON.stringify({
        vendorIds: validVendorIds,
        deadline: deadline.toISOString(),
        count: validVendorIds.length,
      }),
      clientId: expense.clientId,
    });

    return NextResponse.json({
      ok: true,
      invitedCount: bids.length,
      bids: bids.map((b) => ({
        id: b.id,
        vendorId: b.vendorId,
        status: b.status,
        deadline: b.deadline.toISOString(),
      })),
    });
  } catch (e) {
    console.error('[POST /api/pm/expenses/:id/bids]', e);
    return NextResponse.json({ ok: false, error: 'Failed to invite vendors' }, { status: 500 });
  }
}
