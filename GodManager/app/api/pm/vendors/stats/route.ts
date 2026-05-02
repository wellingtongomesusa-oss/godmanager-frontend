import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

function sumToNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'object' && v !== null && 'toString' in v) return Number((v as { toString(): string }).toString());
  return Number(v);
}

/**
 * GET /api/pm/vendors/stats
 *
 * Aggregated PmExpense per vendor: Jobs (all) vs Invoices (FINALIZED only).
 *
 * Query params:
 *   - vendorId — restrict to one vendor
 *   - monthsBack — max rows in monthlyBreakdown per vendor (default 12), most recent first
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const vendorIdFilter = searchParams.get('vendorId')?.trim() || null;
    const monthsBack = Math.min(60, Math.max(1, parseInt(searchParams.get('monthsBack') || '12', 10) || 12));

    const baseWhere: Prisma.PmExpenseWhereInput = {};
    if (vendorIdFilter) baseWhere.vendorId = vendorIdFilter;

    const finalizedWhere: Prisma.PmExpenseWhereInput = { ...baseWhere, status: 'FINALIZED' };

    const [byVendorAll, byVendorFin, byVendorMonthAll, byVendorMonthFin] = await Promise.all([
      prisma.pmExpense.groupBy({
        by: ['vendorId'],
        where: baseWhere,
        _count: { _all: true },
        _sum: { vendorCost: true, ownerCharged: true },
      }),
      prisma.pmExpense.groupBy({
        by: ['vendorId'],
        where: finalizedWhere,
        _count: { _all: true },
        _sum: { vendorCost: true, ownerCharged: true },
      }),
      prisma.pmExpense.groupBy({
        by: ['vendorId', 'monthRef'],
        where: baseWhere,
        _count: { _all: true },
        _sum: { vendorCost: true, ownerCharged: true },
        orderBy: [{ vendorId: 'asc' }, { monthRef: 'desc' }],
      }),
      prisma.pmExpense.groupBy({
        by: ['vendorId', 'monthRef'],
        where: finalizedWhere,
        _count: { _all: true },
        _sum: { vendorCost: true, ownerCharged: true },
        orderBy: [{ vendorId: 'asc' }, { monthRef: 'desc' }],
      }),
    ]);

    const finVendorMap = new Map<string | null, (typeof byVendorFin)[number]>();
    byVendorFin.forEach((v) => finVendorMap.set(v.vendorId, v));

    const finMonthMap = new Map<string, (typeof byVendorMonthFin)[number]>();
    byVendorMonthFin.forEach((m) => {
      const key = (m.vendorId ?? '__null__') + '|' + m.monthRef;
      finMonthMap.set(key, m);
    });

    const vendorIds = byVendorAll.map((v) => v.vendorId).filter((id): id is string => !!id);

    const vendors = await prisma.pmVendor.findMany({
      where: { id: { in: vendorIds.length ? vendorIds : ['__none__'] } },
      select: { id: true, companyName: true, commissionMp: true },
    });

    const vendorMap = new Map(vendors.map((v) => [v.id, v]));

    const stats = byVendorAll.map((v) => {
      const vendor = v.vendorId ? vendorMap.get(v.vendorId) : null;
      const fin = finVendorMap.get(v.vendorId);

      const monthlyAll = byVendorMonthAll
        .filter((m) => m.vendorId === v.vendorId)
        .sort((a, b) => String(b.monthRef).localeCompare(String(a.monthRef)))
        .slice(0, monthsBack);

      const monthlyBreakdown = monthlyAll.map((m) => {
        const key = (m.vendorId ?? '__null__') + '|' + m.monthRef;
        const finM = finMonthMap.get(key);
        return {
          monthRef: m.monthRef,
          count: m._count._all,
          countFinalized: finM ? finM._count._all : 0,
          vendorCost: sumToNum(m._sum.vendorCost),
          vendorCostFinalized: finM ? sumToNum(finM._sum.vendorCost) : 0,
          ownerCharged: sumToNum(m._sum.ownerCharged),
          ownerChargedFinalized: finM ? sumToNum(finM._sum.ownerCharged) : 0,
        };
      });

      return {
        vendorId: v.vendorId,
        companyName: vendor?.companyName ?? '(unknown vendor)',
        commissionMp: vendor?.commissionMp ?? false,
        totalJobs: v._count._all,
        totalInvoices: fin ? fin._count._all : 0,
        jobsVendorCost: sumToNum(v._sum.vendorCost),
        jobsOwnerCharged: sumToNum(v._sum.ownerCharged),
        invoicesVendorCost: fin ? sumToNum(fin._sum.vendorCost) : 0,
        invoicesOwnerCharged: fin ? sumToNum(fin._sum.ownerCharged) : 0,
        monthlyBreakdown,
      };
    });

    stats.sort((a, b) => b.jobsOwnerCharged - a.jobsOwnerCharged);

    return NextResponse.json({
      ok: true,
      stats,
      filters: { vendorId: vendorIdFilter, monthsBack },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'internal_error';
    console.error('[/api/pm/vendors/stats]', e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
