import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getPmExpensesListWhere } from '@/lib/pmExpensesScope';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const groups = await prisma.pmExpense.groupBy({
      by: ['propertyId'],
      _count: { _all: true },
      where: getPmExpensesListWhere(user),
    });

    const propIds = groups.map((g) => g.propertyId);
    const props =
      propIds.length > 0
        ? await prisma.property.findMany({
            where: { id: { in: propIds } },
            select: { id: true, code: true },
          })
        : [];
    const idToCode = new Map(props.map((p) => [p.id, p.code]));

    const counts: Record<string, number> = {};
    let total = 0;
    for (const g of groups) {
      const code = idToCode.get(g.propertyId);
      if (!code) continue;
      counts[code] = g._count._all;
      total += g._count._all;
    }

    return NextResponse.json({ ok: true, counts, total });
  } catch (e) {
    console.error('[GET /api/pm/expenses/count-by-property]', e);
    return NextResponse.json({ ok: false, error: 'Failed to count expenses' }, { status: 500 });
  }
}
