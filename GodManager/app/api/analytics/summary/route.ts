import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveAnalyticsClientId } from '@/lib/analyticsResolveClientId';
import { GLEntryPaidStatus, Prisma, UserRole } from '@prisma/client';
import { buildAnalyticsGLEntryFilters } from '@/lib/analyticsGLEntryFilters';

export const dynamic = 'force-dynamic';

const cpaAccounts = {
  rentIncome: ['4100'],
  ownerDistrib: ['3250'],
  mgmtFees: ['6111'],
  hoaDues: ['6075'],
  secDeposits: ['1160', '2101', '2103', '2105'],
} as const;

export async function GET(req: Request) {
  try {
    const user = await getCurrentUserFromSession();
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    if (user.role !== UserRole.super_admin) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const clientId = await resolveAnalyticsClientId(user, req);
    if (!clientId) {
      return NextResponse.json({ ok: false, error: 'No clientId resolved' }, { status: 400 });
    }

    const url = new URL(req.url);
    const { where, whereForCpa, monthsWhereSql } = buildAnalyticsGLEntryFilters(clientId, url.searchParams);

    const [
      totalEntries,
      sumDebit,
      sumCredit,
      countPaid,
      countUnpaid,
      typesAgg,
      payeesAgg,
      accountsAgg,
      monthsAgg,
      ...cpaAggs
    ] = await Promise.all([
      prisma.gLEntry.count({ where }),
      prisma.gLEntry.aggregate({ where, _sum: { debit: true } }),
      prisma.gLEntry.aggregate({ where, _sum: { credit: true } }),
      prisma.gLEntry.count({ where: { ...where, paidStatus: GLEntryPaidStatus.PAID } }),
      prisma.gLEntry.count({ where: { ...where, paidStatus: GLEntryPaidStatus.UNPAID } }),
      prisma.gLEntry.groupBy({
        by: ['entryType'],
        where,
        _count: { _all: true },
        _sum: { debit: true, credit: true },
      }),
      prisma.gLEntry.groupBy({
        by: ['payee'],
        where: { ...where, payee: { not: null } },
        _count: { _all: true },
        _sum: { debit: true, credit: true },
      }),
      prisma.gLEntry.groupBy({
        by: ['accountCode', 'account'],
        where: { ...where, accountCode: { not: null } },
        _count: { _all: true },
        _sum: { debit: true, credit: true },
      }),
      prisma.$queryRaw<{ period: string; count: bigint }[]>(Prisma.sql`
        SELECT TO_CHAR(e."entryDate", 'YYYY-MM') AS period, COUNT(*)::bigint AS count
        FROM gl_entries e
        WHERE ${monthsWhereSql}
        GROUP BY period ORDER BY period DESC LIMIT 24
      `),
      ...Object.values(cpaAccounts).map((codes) =>
        prisma.gLEntry.aggregate({
          where: { ...whereForCpa, accountCode: { in: [...codes] } },
          _sum: { debit: true, credit: true },
          _count: { _all: true },
        }),
      ),
    ]);

    const payeesTop = [...payeesAgg].sort((a, b) => b._count._all - a._count._all).slice(0, 50);
    const accountsTop = [...accountsAgg].sort((a, b) => b._count._all - a._count._all).slice(0, 50);

    const cpaBreakdown: Record<string, unknown> = {};
    let i = 0;
    for (const key of Object.keys(cpaAccounts) as (keyof typeof cpaAccounts)[]) {
      const codes = cpaAccounts[key];
      const agg = cpaAggs[i++];
      const debit = Number(agg._sum.debit || 0);
      const credit = Number(agg._sum.credit || 0);
      cpaBreakdown[key] = {
        totalDebit: debit.toFixed(2),
        totalCredit: credit.toFixed(2),
        net: (credit - debit).toFixed(2),
        count: agg._count._all,
        accountCodes: codes,
      };
    }

    return NextResponse.json({
      ok: true,
      summary: {
        totalEntries,
        totalDebit: sumDebit._sum.debit?.toString() || '0',
        totalCredit: sumCredit._sum.credit?.toString() || '0',
        countPaid,
        countUnpaid,
      },
      cpaBreakdown,
      types: typesAgg.map((t) => ({
        type: t.entryType,
        count: t._count._all,
        debit: t._sum.debit?.toString() || '0',
        credit: t._sum.credit?.toString() || '0',
      })),
      topPayees: payeesTop.map((p) => ({
        payee: p.payee,
        count: p._count._all,
        debit: p._sum.debit?.toString() || '0',
        credit: p._sum.credit?.toString() || '0',
      })),
      accounts: accountsTop.map((a) => ({
        accountCode: a.accountCode,
        account: a.account,
        count: a._count._all,
        debit: a._sum.debit?.toString() || '0',
        credit: a._sum.credit?.toString() || '0',
      })),
      months: monthsAgg.map((m) => ({ period: m.period, count: Number(m.count) })),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown';
    console.error('analytics summary error:', e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
