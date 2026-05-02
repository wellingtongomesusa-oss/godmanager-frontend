import { NextRequest, NextResponse } from 'next/server';
import type { Prisma, PmExpenseStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

const PM_EXPENSE_STATUSES: PmExpenseStatus[] = [
  'SCHEDULED',
  'PAID',
  'PENDING',
  'CANCELLED',
  'FINALIZED',
];

function isPmExpenseStatus(s: string): s is PmExpenseStatus {
  return (PM_EXPENSE_STATUSES as readonly string[]).includes(s);
}

function sumToNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'object' && v !== null && 'toString' in v) return Number((v as { toString(): string }).toString());
  return Number(v);
}

/**
 * GET /api/pm/vendors/stats
 *
 * Aggregated PmExpense per vendor (+ monthly breakdown by monthRef).
 *
 * Query params:
 *   - vendorId — restrict to one vendor
 *   - status — PmExpenseStatus (omit or ALL for no filter)
 *   - monthsBack — max rows in monthlyBreakdown per vendor (default 12), most recent first
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const vendorIdFilter = searchParams.get('vendorId')?.trim() || null;
    const statusFilterRaw = searchParams.get('status')?.trim() || null;
    const monthsBack = Math.min(60, Math.max(1, parseInt(searchParams.get('monthsBack') || '12', 10) || 12));

    const where: Prisma.PmExpenseWhereInput = {};
    if (vendorIdFilter) where.vendorId = vendorIdFilter;
    if (statusFilterRaw && statusFilterRaw.toUpperCase() !== 'ALL' && isPmExpenseStatus(statusFilterRaw)) {
      where.status = statusFilterRaw;
    }

    const byVendor = await prisma.pmExpense.groupBy({
      by: ['vendorId'],
      where,
      _count: { _all: true },
      _sum: {
        vendorCost: true,
        ownerCharged: true,
      },
    });

    const byVendorMonth = await prisma.pmExpense.groupBy({
      by: ['vendorId', 'monthRef'],
      where,
      _count: { _all: true },
      _sum: {
        vendorCost: true,
        ownerCharged: true,
      },
      orderBy: [{ vendorId: 'asc' }, { monthRef: 'desc' }],
    });

    const vendorIds = byVendor.map((v) => v.vendorId).filter((id): id is string => id != null && id !== '');

    const vendors = await prisma.pmVendor.findMany({
      where: { id: { in: vendorIds.length ? vendorIds : ['__none__'] } },
      select: {
        id: true,
        companyName: true,
        commissionMp: true,
      },
    });

    const vendorMap = new Map(vendors.map((v) => [v.id, v]));

    const stats = byVendor.map((v) => {
      const vendor = v.vendorId ? vendorMap.get(v.vendorId) : null;
      const monthlyBreakdown = byVendorMonth
        .filter((m) => m.vendorId === v.vendorId)
        .sort((a, b) => String(b.monthRef).localeCompare(String(a.monthRef)))
        .slice(0, monthsBack)
        .map((m) => ({
          monthRef: m.monthRef,
          count: m._count._all,
          vendorCost: sumToNumber(m._sum.vendorCost),
          ownerCharged: sumToNumber(m._sum.ownerCharged),
        }));

      return {
        vendorId: v.vendorId,
        companyName: vendor?.companyName ?? '(unknown vendor)',
        commissionMp: vendor?.commissionMp ?? false,
        totalExpenses: v._count._all,
        totalVendorCost: sumToNumber(v._sum.vendorCost),
        totalOwnerCharged: sumToNumber(v._sum.ownerCharged),
        monthlyBreakdown,
      };
    });

    stats.sort((a, b) => b.totalOwnerCharged - a.totalOwnerCharged);

    return NextResponse.json({
      ok: true,
      stats,
      filters: {
        vendorId: vendorIdFilter,
        status: statusFilterRaw,
        monthsBack,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'internal_error';
    console.error('[/api/pm/vendors/stats]', e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
