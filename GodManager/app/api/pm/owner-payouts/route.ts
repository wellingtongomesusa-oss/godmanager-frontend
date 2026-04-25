import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolvePropertyId } from '@/lib/pmResolveProperty';
import { computeNetForPropertyMonth } from '@/lib/pmNetCompute';

export const dynamic = 'force-dynamic';

/**
 * Marcar owner como pago (dia 15). Body: { propertyId | propertyCode, yearMonth, paidAt? }
 */
export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const prop = await resolvePropertyId(String(body.propertyId || body.propertyCode || '').trim());
    if (!prop) return NextResponse.json({ ok: false, error: 'Property not found' }, { status: 404 });

    const yearMonth = String(body.yearMonth || '').trim();
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
      return NextResponse.json({ ok: false, error: 'yearMonth must be YYYY-MM' }, { status: 400 });
    }

    const paidAt = body.paidAt ? new Date(String(body.paidAt)) : new Date();
    if (Number.isNaN(paidAt.getTime())) {
      return NextResponse.json({ ok: false, error: 'Invalid paidAt' }, { status: 400 });
    }

    const row = await prisma.ownerMonthPayout.upsert({
      where: { propertyId_yearMonth: { propertyId: prop.id, yearMonth } },
      create: { propertyId: prop.id, yearMonth, paidAt },
      update: { paidAt },
    });

    return NextResponse.json({
      ok: true,
      payout: {
        id: row.id,
        propertyId: row.propertyId,
        yearMonth: row.yearMonth,
        paidAt: row.paidAt?.toISOString() ?? null,
      },
    });
  } catch (e) {
    console.error('[POST /api/pm/owner-payouts]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get('propertyId') || '';
    const yearMonth = searchParams.get('yearMonth') || '';
    const prop = await resolvePropertyId(propertyId);
    if (!prop || !/^\d{4}-\d{2}$/.test(yearMonth)) {
      return NextResponse.json({ ok: false, error: 'Invalid params' }, { status: 400 });
    }
    await prisma.ownerMonthPayout.deleteMany({
      where: { propertyId: prop.id, yearMonth },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[DELETE /api/pm/owner-payouts]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}

/** Vista agregada por owner (Owner Payment) */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const yearMonth = searchParams.get('month') || '';
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    return NextResponse.json({ ok: false, error: 'month YYYY-MM required' }, { status: 400 });
  }

  try {
    const properties = await prisma.property.findMany({
      orderBy: { ownerName: 'asc' },
      include: {
        pmExpenses: {
          where: { monthRef: yearMonth, status: { in: ['SCHEDULED', 'PAID', 'PENDING'] } },
          include: { vendor: { select: { companyName: true } } },
          orderBy: { serviceDate: 'asc' },
        },
        ownerMonthPayouts: { where: { yearMonth } },
      },
    });

    const byOwner: Record<
      string,
      {
        ownerName: string;
        properties: Array<{
          propertyId: string;
          code: string;
          address: string;
          rent: number;
          net: number;
          expensesTotal: number;
          expenses: Array<{
            id: string;
            vendorName: string;
            vendorCost: string;
            packageApplied: string;
            markupPct: number;
            ownerCharged: string;
            serviceType: string;
          }>;
          paidAt: string | null;
        }>;
      }
    > = {};

    const mPct: Record<string, number> = { PACOTE_1: 15, PACOTE_2: 18, PACOTE_3: 25, PACOTE_4: 0 };

    for (const p of properties) {
      const ownerName = p.ownerName?.trim() || 'Sem owner';
      if (!byOwner[ownerName]) {
        byOwner[ownerName] = { ownerName, properties: [] };
      }
      const { net, rent, expensesOwnerCharged } = await computeNetForPropertyMonth(p.id, yearMonth);
      const payout = p.ownerMonthPayouts[0];
      byOwner[ownerName].properties.push({
        propertyId: p.id,
        code: p.code,
        address: p.address,
        rent,
        net,
        expensesTotal: expensesOwnerCharged,
        expenses: p.pmExpenses.map((e) => ({
          id: e.id,
          vendorName: e.vendor?.companyName ?? '—',
          vendorCost: e.vendorCost.toString(),
          packageApplied: e.packageApplied,
          markupPct: mPct[e.packageApplied] ?? 0,
          ownerCharged: e.ownerCharged.toString(),
          serviceType: e.serviceType ?? '',
        })),
        paidAt: payout?.paidAt ? payout.paidAt.toISOString() : null,
      });
    }

    const groups = Object.values(byOwner);
    const totalNetToPay = groups.reduce(
      (s, g) => s + g.properties.reduce((a, b) => a + (b.paidAt ? 0 : b.net), 0),
      0
    );
    const totalProperties = properties.length;
    const paidCount = properties.filter((p) => p.ownerMonthPayouts[0]?.paidAt).length;

    return NextResponse.json({
      ok: true,
      yearMonth,
      summary: {
        totalDue15th: Math.round(totalNetToPay * 100) / 100,
        paidCount,
        pendingCount: totalProperties - paidCount,
        totalProperties,
      },
      owners: groups,
    });
  } catch (e) {
    console.error('[GET /api/pm/owner-payouts]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
