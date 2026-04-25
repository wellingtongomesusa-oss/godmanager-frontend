import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { computeNetForPropertyMonth, getPayoutState } from '@/lib/pmNetCompute';

export const dynamic = 'force-dynamic';

function ymNow(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') || ymNow();

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ ok: false, error: 'Invalid month' }, { status: 400 });
  }

  try {
    const properties = await prisma.property.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, code: true, address: true, ownerName: true, rent: true },
    });

    const items = await Promise.all(
      properties.map(async (p) => {
        const { rent, expensesOwnerCharged, net } = await computeNetForPropertyMonth(p.id, month);
        const payout = await getPayoutState(p.id, month);
        const today = new Date();
        const [y, m] = month.split('-').map(Number);
        const d15 = new Date(y, m - 1, 15);
        let payBadge: 'paid' | 'due_15' | 'overdue' = 'due_15';
        if (payout?.paidAt) payBadge = 'paid';
        else if (today > d15) payBadge = 'overdue';
        return {
          propertyId: p.id,
          code: p.code,
          address: p.address,
          ownerName: p.ownerName ?? '',
          rent,
          expensesMonth: expensesOwnerCharged,
          net,
          payStatus: payBadge,
          ownerPaidAt: payout?.paidAt ? payout.paidAt.toISOString() : null,
        };
      })
    );

    return NextResponse.json({ ok: true, month, properties: items });
  } catch (e) {
    console.error('[GET /api/pm/summary]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
