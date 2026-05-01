import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolvePropertyId } from '@/lib/pmResolveProperty';
import { computeNetForPropertyMonth } from '@/lib/pmNetCompute';
import { monthRefQueryValues } from '@/lib/pmMonthRef';
import type { PmPackage } from '@prisma/client';

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
    if (!/^\d{4}-\d{1,2}$/.test(yearMonth)) {
      return NextResponse.json({ ok: false, error: 'yearMonth must be YYYY-M(M)' }, { status: 400 });
    }
    const m = /^(\d{4})-(\d{1,2})$/.exec(yearMonth);
    const yearMonthPadded = m ? `${m[1]}-${String(parseInt(m[2], 10)).padStart(2, '0')}` : yearMonth;

    const paidAt = body.paidAt ? new Date(String(body.paidAt)) : new Date();
    if (Number.isNaN(paidAt.getTime())) {
      return NextResponse.json({ ok: false, error: 'Invalid paidAt' }, { status: 400 });
    }

    const row = await prisma.ownerMonthPayout.upsert({
      where: { propertyId_yearMonth: { propertyId: prop.id, yearMonth: yearMonthPadded } },
      create: { propertyId: prop.id, yearMonth: yearMonthPadded, paidAt },
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
    if (!prop || !/^\d{4}-\d{1,2}$/.test(yearMonth)) {
      return NextResponse.json({ ok: false, error: 'Invalid params' }, { status: 400 });
    }
    const m = /^(\d{4})-(\d{1,2})$/.exec(yearMonth);
    const padded = m ? `${m[1]}-${String(parseInt(m[2], 10)).padStart(2, '0')}` : yearMonth;
    await prisma.ownerMonthPayout.deleteMany({
      where: { propertyId: prop.id, yearMonth: { in: monthRefQueryValues(padded) } },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[DELETE /api/pm/owner-payouts]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}

const M_PCT: Record<PmPackage, number> = { PACOTE_1: 15, PACOTE_2: 18, PACOTE_3: 25, PACOTE_4: 0 };

/** Vista agregada por owner (Owner Payment) */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const raw = String(searchParams.get('month') || '').trim();
  const mp = /^(\d{4})-(\d{1,2})$/.exec(raw);
  if (!mp) {
    return NextResponse.json({ ok: false, error: 'month YYYY-M(M) required' }, { status: 400 });
  }
  const yearMonth = `${mp[1]}-${String(parseInt(mp[2], 10)).padStart(2, '0')}`;
  const monthKeys = monthRefQueryValues(yearMonth);

  try {
    const [properties, monthExpenses] = await Promise.all([
      prisma.property.findMany({
        orderBy: { ownerName: 'asc' },
        include: { ownerMonthPayouts: { where: { yearMonth: { in: monthKeys } } } },
      }),
      // Todas as despesas do mês por propriedade (com ou sem pacote) — nunca filtrar por pmPackage / packageApplied
      prisma.pmExpense.findMany({
        where: {
          monthRef: { in: monthKeys },
          status: { in: ['SCHEDULED', 'PAID', 'PENDING', 'FINALIZED'] },
        },
        include: { vendor: { select: { companyName: true } } },
        orderBy: [{ serviceDate: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);

    const byPropertyId = new Map<string, typeof monthExpenses>();
    for (const e of monthExpenses) {
      const list = byPropertyId.get(e.propertyId) ?? [];
      list.push(e);
      byPropertyId.set(e.propertyId, list);
    }

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
          totalVendorCost: number;
          totalMarkupAmount: number;
          expenses: Array<{
            id: string;
            vendorName: string;
            vendorCost: string;
            ownerCharged: string;
            packageApplied: string;
            pmPackage: string;
            markupPct: number;
            serviceType: string;
          }>;
          paidAt: string | null;
        }>;
      }
    > = {};

    for (const p of properties) {
      const ownerName = p.ownerName?.trim() || 'Sem owner';
      if (!byOwner[ownerName]) {
        byOwner[ownerName] = { ownerName, properties: [] };
      }
      const { net, rent, expensesOwnerCharged } = await computeNetForPropertyMonth(p.id, yearMonth);
      const exList = byPropertyId.get(p.id) ?? [];
      let totalVendor = 0;
      let totalMarkup = 0;
      const expRows = exList.map((e) => {
        const v = Number(e.vendorCost);
        const o = Number(e.ownerCharged);
        if (Number.isFinite(v)) totalVendor += v;
        if (Number.isFinite(v) && Number.isFinite(o)) totalMarkup += o - v;
        const pkg = e.packageApplied;
        return {
          id: e.id,
          vendorName: e.vendor?.companyName ?? '—',
          vendorCost: e.vendorCost.toString(),
          ownerCharged: e.ownerCharged.toString(),
          packageApplied: pkg,
          pmPackage: pkg,
          markupPct: M_PCT[pkg] ?? 0,
          serviceType: e.serviceType ?? '',
        };
      });
      const pouts = p.ownerMonthPayouts;
      const payout = pouts.find((o) => o.paidAt) ?? pouts[0];
      byOwner[ownerName].properties.push({
        propertyId: p.id,
        code: p.code,
        address: p.address,
        rent,
        net,
        expensesTotal: expensesOwnerCharged,
        totalVendorCost: Math.round(totalVendor * 100) / 100,
        totalMarkupAmount: Math.round(totalMarkup * 100) / 100,
        expenses: expRows,
        paidAt: payout?.paidAt ? payout.paidAt.toISOString() : null,
      });
    }

    const groups = Object.values(byOwner);
    const totalNetToPay = groups.reduce(
      (s, g) => s + g.properties.reduce((a, b) => a + (b.paidAt ? 0 : b.net), 0),
      0
    );
    const totalProperties = properties.length;
    const paidCount = properties.filter((p) => p.ownerMonthPayouts.some((o) => o.paidAt)).length;

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
