import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';
import { isGhostPortfolioProperty } from '@/lib/portfolioGhost';

export const dynamic = 'force-dynamic';

const PARTICIPATION_GOAL_HOUSES = [142, 213, 320] as const;

function parseMonthsParam(raw: string | null): number {
  const n = raw != null ? parseInt(raw, 10) : 12;
  if (!Number.isFinite(n) || n < 1) return 12;
  return Math.min(24, Math.max(1, n));
}

/** End of calendar month in UTC (23:59:59.999). month1to12 = 1..12 */
function endOfMonthUtc(year: number, month1to12: number): Date {
  return new Date(Date.UTC(year, month1to12, 0, 23, 59, 59, 999));
}

function formatYm(year: number, month1to12: number): string {
  return `${year}-${String(month1to12).padStart(2, '0')}`;
}

function formatEndDate(year: number, month1to12: number): string {
  const d = endOfMonthUtc(year, month1to12);
  return d.toISOString().slice(0, 10);
}

/** GET /api/properties/timeline?months=12 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const monthCount = parseMonthsParam(searchParams.get('months'));

    const scopeUser = toClientScopeUser(user);
    const scope = getClientScopeWhere(scopeUser);

    const properties = await prisma.property.findMany({
      where: scope,
      select: { createdAt: true, address: true, code: true, metadata: true },
    });

    const createdAts = properties
      .filter((p) => !isGhostPortfolioProperty(p))
      .map((p) => p.createdAt)
      .filter((d): d is Date => d instanceof Date);

    const now = new Date();
    const endYear = now.getUTCFullYear();
    const endMonth = now.getUTCMonth() + 1;

    const months: { ym: string; endDate: string; count: number }[] = [];

    for (let i = monthCount - 1; i >= 0; i--) {
      let y = endYear;
      let m = endMonth - i;
      while (m <= 0) {
        m += 12;
        y -= 1;
      }
      const end = endOfMonthUtc(y, m);
      const count = createdAts.filter((ca) => ca.getTime() <= end.getTime()).length;
      months.push({
        ym: formatYm(y, m),
        endDate: formatEndDate(y, m),
        count,
      });
    }

    const currentTotal = months.length ? months[months.length - 1].count : createdAts.length;

    return NextResponse.json({
      ok: true,
      months,
      currentTotal,
      goals: [...PARTICIPATION_GOAL_HOUSES],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed';
    console.error('[GET /api/properties/timeline]', e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
