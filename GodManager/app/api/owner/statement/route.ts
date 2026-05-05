import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function GET(req: NextRequest) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const propertyId = url.searchParams.get('propertyId') ?? '';
  const period = url.searchParams.get('period') ?? '';

  if (!propertyId || !PERIOD_RE.test(period)) {
    return NextResponse.json(
      { ok: false, error: 'invalid_params' },
      { status: 400 },
    );
  }

  try {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        owner: true,
        client: { select: { id: true, companyName: true, logoUrl: true } },
      },
    });

    if (!property) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    }

    const isSuperAdmin = user.role === 'super_admin';
    const ownerMatch =
      user.role === 'owner' &&
      user.ownerId !== null &&
      property.ownerId === user.ownerId;

    if (!isSuperAdmin && !ownerMatch) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const payout = await prisma.ownerMonthPayout.findUnique({
      where: {
        propertyId_yearMonth: {
          propertyId: property.id,
          yearMonth: period,
        },
      },
      include: {
        statementLineItems: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      property: {
        id: property.id,
        code: property.code,
        address: property.address,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        ownerName: property.owner?.name ?? property.ownerName,
        ownerEmail: property.owner?.email ?? property.ownerEmail,
        clientName: property.client?.companyName ?? null,
        clientLogoUrl: property.client?.logoUrl ?? null,
      },
      period,
      payout: payout
        ? {
            id: payout.id,
            yearMonth: payout.yearMonth,
            totalIncome: payout.totalIncome?.toString() ?? '0',
            totalExpenses: payout.totalExpenses?.toString() ?? '0',
            netPayout: payout.netPayout?.toString() ?? '0',
            previousBalance: payout.previousBalance?.toString() ?? '0',
            paidAt: payout.paidAt?.toISOString() ?? null,
            paidAmount: payout.paidAmount?.toString() ?? null,
            notes: payout.notes,
            lineItems: payout.statementLineItems.map((li) => ({
              id: li.id,
              lineType: li.lineType,
              description: li.description,
              amount: li.amount.toString(),
              sortOrder: li.sortOrder,
            })),
          }
        : null,
    });
  } catch (e) {
    console.error('[GET /api/owner/statement]', e);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}
