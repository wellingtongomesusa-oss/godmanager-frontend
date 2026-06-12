import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';
import { recordAudit } from '@/lib/auditServer';
import { FollowUpMergeError, mergeFollowUpMetadata } from '@/lib/jobFollowUp';
import { ownerChargedAmount } from '@/lib/pmPackages';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const INVITE_ROLES = new Set(['super_admin', 'admin', 'manager', 'supervisor', 'supervisor_2']);

function parseYyyyMmDd(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return null;
  return s;
}

function parseExecutionDates(raw: unknown): [string, string] | null {
  if (!Array.isArray(raw) || raw.length !== 2) return null;
  const a = parseYyyyMmDd(raw[0]);
  const b = parseYyyyMmDd(raw[1]);
  if (!a || !b) return null;
  return a <= b ? [a, b] : [b, a];
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

    const winnerVendorId = String((body as { winnerVendorId?: unknown }).winnerVendorId ?? '').trim();
    if (!winnerVendorId) {
      return NextResponse.json({ ok: false, error: 'winnerVendorId is required' }, { status: 400 });
    }

    const executionDates = parseExecutionDates((body as { executionDates?: unknown }).executionDates);
    if (!executionDates) {
      return NextResponse.json(
        { ok: false, error: 'executionDates must be an array of exactly 2 valid YYYY-MM-DD dates' },
        { status: 400 },
      );
    }
    const [d1, d2] = executionDates;

    const scopeUser = toClientScopeUser(user);
    const expense = await prisma.pmExpense.findFirst({
      where: { id: expenseId, ...getClientScopeWhere(scopeUser) },
      select: { id: true, clientId: true, packageApplied: true, metadata: true },
    });
    if (!expense) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    const bid = await prisma.jobBid.findUnique({
      where: { expenseId_vendorId: { expenseId, vendorId: winnerVendorId } },
      select: { id: true, status: true, amount: true },
    });
    if (!bid) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    const bidStatus = String(bid.status || '').toLowerCase();
    if (bidStatus !== 'submitted') {
      return NextResponse.json(
        { ok: false, error: 'vencedor precisa ter proposta enviada' },
        { status: 400 },
      );
    }

    const winnerAmount = bid.amount != null ? Number(bid.amount) : NaN;
    if (!Number.isFinite(winnerAmount) || winnerAmount <= 0) {
      return NextResponse.json({ ok: false, error: 'Invalid winner bid amount' }, { status: 400 });
    }

    const ownerCharged = ownerChargedAmount(winnerAmount, expense.packageApplied);
    const serviceDate = new Date(String(d1));
    if (Number.isNaN(serviceDate.getTime())) {
      return NextResponse.json({ ok: false, error: 'Invalid serviceDate' }, { status: 400 });
    }
    const now = new Date();
    const atIso = now.toISOString();
    const auditBy = String(user.email || user.id || 'unknown').trim();

    let nextMeta: Record<string, unknown>;
    try {
      const merged = mergeFollowUpMetadata(
        expense.metadata,
        { stage: 'awaiting_vendor', queue: 'vendor' },
        { by: auditBy, at: atIso },
      );
      nextMeta = {
        ...merged,
        execution: {
          dates: [d1, d2],
          setBy: auditBy,
          setAt: atIso,
        },
      };
    } catch (e) {
      if (e instanceof FollowUpMergeError) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
      }
      throw e;
    }

    await prisma.$transaction(async (tx) => {
      await tx.jobBid.update({
        where: { id: bid.id },
        data: { status: 'won' },
      });

      await tx.jobBid.updateMany({
        where: { expenseId, vendorId: { not: winnerVendorId } },
        data: { status: 'lost' },
      });

      await tx.pmExpense.update({
        where: { id: expenseId },
        data: {
          vendorId: winnerVendorId,
          vendorCost: new Prisma.Decimal(String(winnerAmount)),
          ownerCharged: new Prisma.Decimal(String(ownerCharged)),
          serviceDate,
          metadata: nextMeta as Prisma.InputJsonValue,
        },
      });
    });

    await recordAudit({
      request: req,
      actor: { id: user.id, email: user.email },
      action: 'job_bid.select_winner',
      entity: 'pm_expense',
      entityId: expenseId,
      details: JSON.stringify({
        winnerVendorId,
        amount: winnerAmount,
        ownerCharged,
        executionDates: [d1, d2],
      }),
      clientId: expense.clientId,
    });

    return NextResponse.json({
      ok: true,
      winnerVendorId,
      amount: winnerAmount,
      ownerCharged,
      queue: 'vendor',
      executionDates: [d1, d2],
    });
  } catch (e) {
    console.error('[POST /api/pm/expenses/:id/bids/select-winner]', e);
    return NextResponse.json({ ok: false, error: 'Failed to select winner' }, { status: 500 });
  }
}
