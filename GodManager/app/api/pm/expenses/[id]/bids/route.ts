import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';
import { recordAudit } from '@/lib/auditServer';
import { FollowUpMergeError, mergeFollowUpMetadata } from '@/lib/jobFollowUp';
import { publicUrlForKey } from '@/lib/r2';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const INVITE_ROLES = new Set(['super_admin', 'admin', 'manager', 'supervisor', 'supervisor_2']);

const SUBMIT_ALLOWED_STATUSES = new Set(['invited', 'submitted']);

const SUBMIT_ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

function jobBidInvoiceKeyPrefix(
  clientId: string | null | undefined,
  expenseId: string,
  vendorId: string,
): string {
  return `job-bids/${clientId || 'no-client'}/${expenseId}/${vendorId}/`;
}

function isVendorSubmitUser(user: { role?: string | null; vendorId?: string | null }): string | null {
  const role = String(user.role || '').toLowerCase();
  const vendorId = String(user.vendorId || '').trim();
  if (role !== 'vendor' || !vendorId) return null;
  return vendorId;
}

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

function serializeBid(bid: {
  id: string;
  vendorId: string;
  amount: Prisma.Decimal | null;
  status: string;
  invoiceUrl: string | null;
  invoiceMime: string | null;
  submittedAt: Date | null;
  deadline: Date;
  invitedAt: Date;
  vendor: { id: string; companyName: string } | null;
}) {
  return {
    id: bid.id,
    vendorId: bid.vendorId,
    vendorName: bid.vendor?.companyName ?? '',
    amount: bid.amount != null ? bid.amount.toString() : null,
    status: bid.status,
    invoiceUrl: bid.invoiceUrl,
    invoiceMime: bid.invoiceMime,
    submittedAt: bid.submittedAt ? bid.submittedAt.toISOString() : null,
    deadline: bid.deadline.toISOString(),
    invitedAt: bid.invitedAt.toISOString(),
  };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
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
    const scopeUser = toClientScopeUser(user);
    const expense = await prisma.pmExpense.findFirst({
      where: { id: expenseId, ...getClientScopeWhere(scopeUser) },
      select: { id: true },
    });
    if (!expense) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    const rows = await prisma.jobBid.findMany({
      where: { expenseId },
      include: { vendor: { select: { id: true, companyName: true } } },
      orderBy: [{ amount: 'asc' }, { submittedAt: 'asc' }],
    });

    return NextResponse.json({ ok: true, bids: rows.map(serializeBid) });
  } catch (e) {
    console.error('[GET /api/pm/expenses/:id/bids]', e);
    return NextResponse.json({ ok: false, error: 'Failed to list bids' }, { status: 500 });
  }
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

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const vendorId = isVendorSubmitUser(user);
  if (!vendorId) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const expenseId = String(params.id || '').trim();
  if (!expenseId) {
    return NextResponse.json({ ok: false, error: 'Invalid expense id' }, { status: 400 });
  }

  const bid = await prisma.jobBid.findUnique({
    where: { expenseId_vendorId: { expenseId, vendorId } },
    select: { id: true, status: true, clientId: true, expenseId: true, vendorId: true },
  });
  if (!bid) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  }

  const bidStatus = String(bid.status || '').toLowerCase();
  if (!SUBMIT_ALLOWED_STATUSES.has(bidStatus)) {
    return NextResponse.json({ ok: false, error: 'Bid is not open for submission' }, { status: 409 });
  }

  try {
    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
    }

    const amountRaw = (body as { amount?: unknown }).amount;
    const amountNum = Number(amountRaw);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return NextResponse.json({ ok: false, error: 'amount must be a number greater than 0' }, { status: 400 });
    }

    const invoiceR2Key = String((body as { invoiceR2Key?: unknown }).invoiceR2Key ?? '').trim();
    if (!invoiceR2Key) {
      return NextResponse.json({ ok: false, error: 'invoiceR2Key is required' }, { status: 400 });
    }

    const expectedPrefix = jobBidInvoiceKeyPrefix(bid.clientId, expenseId, vendorId);
    if (!invoiceR2Key.startsWith(expectedPrefix) || invoiceR2Key.includes('..') || invoiceR2Key.includes('//')) {
      return NextResponse.json({ ok: false, error: 'Invalid invoiceR2Key' }, { status: 400 });
    }

    const invoiceMime = String((body as { invoiceMime?: unknown }).invoiceMime ?? '').trim().toLowerCase();
    if (!invoiceMime || !SUBMIT_ALLOWED_MIMES.has(invoiceMime)) {
      return NextResponse.json(
        { ok: false, error: 'invoiceMime must be pdf, jpeg, jpg, png, or webp' },
        { status: 400 },
      );
    }

    const now = new Date();
    const amountDec = new Prisma.Decimal(String(amountNum));
    const invoiceUrl = publicUrlForKey(invoiceR2Key);

    const updated = await prisma.jobBid.update({
      where: { id: bid.id },
      data: {
        amount: amountDec,
        invoiceR2Key,
        invoiceUrl,
        invoiceMime,
        submittedAt: now,
        status: 'submitted',
      },
      select: {
        id: true,
        status: true,
        amount: true,
        submittedAt: true,
        invoiceUrl: true,
      },
    });

    await recordAudit({
      request: req,
      actor: { id: user.id, email: user.email },
      action: 'job_bid.submit',
      entity: 'pm_expense',
      entityId: expenseId,
      details: JSON.stringify({ amount: amountNum, vendorId }),
      clientId: bid.clientId,
    });

    return NextResponse.json({
      ok: true,
      bid: {
        id: updated.id,
        status: updated.status,
        amount: updated.amount != null ? updated.amount.toString() : null,
        submittedAt: updated.submittedAt ? updated.submittedAt.toISOString() : null,
        invoiceUrl: updated.invoiceUrl,
      },
    });
  } catch (e) {
    console.error('[PATCH /api/pm/expenses/:id/bids]', e);
    return NextResponse.json({ ok: false, error: 'Failed to submit bid' }, { status: 500 });
  }
}
