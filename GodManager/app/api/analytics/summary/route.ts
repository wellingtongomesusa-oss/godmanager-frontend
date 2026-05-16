import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { GLEntryPaidStatus, Prisma, UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

function clientIdFromRequest(user: { clientId: string | null }, req: Request): string | null {
  if (user.clientId) return user.clientId;
  const fromHeader = req.headers.get('x-client-id')?.trim();
  return fromHeader || null;
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUserFromSession();
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    if (user.role !== UserRole.super_admin) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const clientId = clientIdFromRequest(user, req);
    if (!clientId) return NextResponse.json({ ok: false, error: 'No clientId' }, { status: 400 });

    const url = new URL(req.url);
    const periodYM = url.searchParams.get('period') || '';

    const where: Prisma.GLEntryWhereInput = { clientId };
    if (periodYM && /^\d{4}-\d{2}$/.test(periodYM)) {
      const [y, m] = periodYM.split('-').map(Number);
      const start = new Date(Date.UTC(y, m - 1, 1));
      const end = new Date(Date.UTC(y, m, 1));
      where.entryDate = { gte: start, lt: end };
    }

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
        SELECT TO_CHAR("entryDate", 'YYYY-MM') AS period, COUNT(*)::bigint AS count
        FROM gl_entries WHERE "clientId" = ${clientId}
        GROUP BY period ORDER BY period DESC LIMIT 24
      `),
    ]);

    const payeesTop = [...payeesAgg].sort((a, b) => b._count._all - a._count._all).slice(0, 50);
    const accountsTop = [...accountsAgg].sort((a, b) => b._count._all - a._count._all).slice(0, 50);

    return NextResponse.json({
      ok: true,
      summary: {
        totalEntries,
        totalDebit: sumDebit._sum.debit?.toString() || '0',
        totalCredit: sumCredit._sum.credit?.toString() || '0',
        countPaid,
        countUnpaid,
      },
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
