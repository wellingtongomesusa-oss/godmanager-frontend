import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';
import { recordAudit } from '@/lib/auditServer';
import { FollowUpMergeError, mergeFollowUpMetadata } from '@/lib/jobFollowUp';

export const dynamic = 'force-dynamic';

const MIN_DESC = 3;
const MAX_DESC = 2000;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const role = String(user.role || '').toLowerCase();
  const userVendorId = String(user.vendorId || '').trim();
  if (role !== 'vendor' || !userVendorId) {
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

    const description = String((body as { description?: unknown }).description ?? '').trim();
    if (description.length < MIN_DESC || description.length > MAX_DESC) {
      return NextResponse.json(
        { ok: false, error: `description must be between ${MIN_DESC} and ${MAX_DESC} characters` },
        { status: 400 },
      );
    }

    const scopeUser = toClientScopeUser(user);
    const expense = await prisma.pmExpense.findFirst({
      where: { id: expenseId, ...getClientScopeWhere(scopeUser) },
      select: { id: true, clientId: true, vendorId: true, metadata: true },
    });
    if (!expense) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    const expenseVendorId = String(expense.vendorId || '').trim();
    if (!expenseVendorId || expenseVendorId !== userVendorId) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const bid = await prisma.jobBid.findUnique({
      where: { expenseId_vendorId: { expenseId, vendorId: userVendorId } },
      select: { status: true },
    });
    if (!bid || bid.status !== 'won') {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const at = new Date().toISOString();
    const by = user.email || user.id;

    let merged: Record<string, unknown>;
    try {
      merged = mergeFollowUpMetadata(expense.metadata, {
        stage: 'vendor_done',
        note: 'Concluido pelo vendor',
      }, { by, at });
    } catch (e) {
      if (e instanceof FollowUpMergeError) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
      }
      throw e;
    }

    const nextMeta = {
      ...merged,
      completion: {
        description,
        completedAt: at,
        completedBy: by,
      },
    };

    await prisma.pmExpense.update({
      where: { id: expense.id },
      data: { metadata: nextMeta as Prisma.InputJsonValue },
    });

    await recordAudit({
      request: req,
      actor: { id: user.id, email: user.email },
      action: 'job.vendor_complete',
      entity: 'pm_expense',
      entityId: expense.id,
      clientId: expense.clientId,
      details: JSON.stringify({ len: description.length }),
    });

    return NextResponse.json({ ok: true, stage: 'vendor_done' });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed';
    console.error('[POST /api/pm/expenses/:id/vendor-complete]', e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
