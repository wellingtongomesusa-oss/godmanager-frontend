import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { toClientScopeUser } from '@/lib/clientScope';
import { ensureOwnerMonthPayoutWithClient } from '@/lib/ownerStatementEmail';
import { normalizeYearMonthForWrite } from '@/lib/pmMonthRef';
import { recomputeOwnerMonthPayoutTotals } from '@/lib/ownerStatementTotals';

export const dynamic = 'force-dynamic';

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function isStmtAdmin(role: string): boolean {
  return role === 'admin' || role === 'super_admin';
}

export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!isStmtAdmin(user.role)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const propertyId = typeof body.propertyId === 'string' ? body.propertyId.trim() : '';
  const yearMonthRaw = typeof body.yearMonth === 'string' ? body.yearMonth.trim() : '';
  const yearMonthNorm = normalizeYearMonthForWrite(yearMonthRaw);

  if (!propertyId || !yearMonthNorm || !YEAR_MONTH.test(yearMonthNorm)) {
    return NextResponse.json({ ok: false, error: 'Invalid propertyId or yearMonth' }, { status: 400 });
  }

  const scopeUser = toClientScopeUser(user);
  const ensured = await ensureOwnerMonthPayoutWithClient({
    scopeUser,
    propertyId,
    yearMonthNorm,
  });

  if (!ensured.ok) {
    const status =
      ensured.error === 'Forbidden'
        ? 403
        : ensured.error === 'Property not found'
          ? 404
          : 400;
    return NextResponse.json({ ok: false, error: ensured.error }, { status });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await recomputeOwnerMonthPayoutTotals(ensured.payoutId, tx);
    return tx.ownerMonthPayout.update({
      where: { id: ensured.payoutId },
      data: {
        closedAt: new Date(),
        closedBy: user.id,
        reopenedAt: null,
        reopenedBy: null,
        reopenedByName: null,
      },
      select: {
        id: true,
        closedAt: true,
        totalIncome: true,
        totalExpenses: true,
        netPayout: true,
      },
    });
  });

  return NextResponse.json({
    ok: true,
    payout: {
      id: updated.id,
      closedAt: updated.closedAt!.toISOString(),
      totalIncome: updated.totalIncome?.toFixed(2) ?? '0.00',
      totalExpenses: updated.totalExpenses?.toFixed(2) ?? '0.00',
      netPayout: updated.netPayout?.toFixed(2) ?? '0.00',
    },
  });
}
