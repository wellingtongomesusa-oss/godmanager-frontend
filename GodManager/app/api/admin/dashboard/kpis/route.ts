import { NextResponse } from 'next/server';
import { withRlsScope } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

function dec(n: unknown): number {
  if (n == null) return 0;
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

/** KPIs globais — apenas super_admin; agregações cross-tenant com RLS bypass. */
export async function GET() {
  try {
    const user = await getCurrentUserFromSession();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Nao autenticado.' }, { status: 401 });
    }
    if (user.role !== 'super_admin') {
      return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });
    }

    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const body = await withRlsScope(user, async (tx) => {
      const [
        clientsTotal,
        clientsActive,
        clientsSuspended,
        clientsNewLast30Days,
        productGroups,
        usersTotal,
        usersActive,
        usersSuspended,
        totalProperties,
        totalTenants,
        totalVendors,
        totalJobs,
        expensesAgg,
        rentAgg,
        netOwnerAgg,
      ] = await Promise.all([
        tx.client.count(),
        tx.client.count({ where: { active: true } }),
        tx.client.count({ where: { active: false } }),
        tx.client.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        tx.client.groupBy({
          by: ['productType'],
          _count: { _all: true },
        }),
        tx.user.count(),
        tx.user.count({ where: { status: 'active' } }),
        tx.user.count({ where: { status: 'suspended' } }),
        tx.property.count(),
        tx.tenant.count(),
        tx.pmVendor.count(),
        tx.jobAction.count(),
        tx.pmExpense.aggregate({
          where: { monthRef: yearMonth },
          _sum: { ownerCharged: true },
        }),
        tx.tenantPayment.aggregate({
          where: {
            paymentDate: { gte: monthStart, lt: monthEnd },
          },
          _sum: { receiptAmount: true },
        }),
        tx.ownerMonthPayout.aggregate({
          where: { yearMonth },
          _sum: { netPayout: true },
        }),
      ]);

      const byProduct = {
        PROPERTY_MANAGEMENT: 0,
        DESIGN_DECORATION: 0,
        EXPENSES_JOBS: 0,
      } as Record<'PROPERTY_MANAGEMENT' | 'DESIGN_DECORATION' | 'EXPENSES_JOBS', number>;

      for (const row of productGroups) {
        const k = row.productType as keyof typeof byProduct;
        if (k in byProduct) byProduct[k] = row._count._all;
      }

      const mrrEstimated = Math.round(clientsTotal * 50 * 100) / 100;

      return {
        clients: {
          total: clientsTotal,
          byProduct,
          active: clientsActive,
          suspended: clientsSuspended,
          newLast30Days: clientsNewLast30Days,
        },
        users: {
          total: usersTotal,
          active: usersActive,
          suspended: usersSuspended,
        },
        portfolio: {
          totalProperties,
          totalTenants,
          totalVendors,
          totalJobs,
        },
        financials: {
          yearMonth,
          expensesCurrentMonth: dec(expensesAgg._sum.ownerCharged),
          rentCurrentMonth: dec(rentAgg._sum.receiptAmount),
          netOwnerCurrentMonth: dec(netOwnerAgg._sum.netPayout),
          mrrEstimated,
        },
        updatedAt: now.toISOString(),
      };
    });

    return NextResponse.json({ ok: true, ...body });
  } catch (e) {
    console.error('[admin/dashboard/kpis]', e);
    return NextResponse.json({ ok: false, error: 'Erro ao carregar indicadores.' }, { status: 500 });
  }
}
