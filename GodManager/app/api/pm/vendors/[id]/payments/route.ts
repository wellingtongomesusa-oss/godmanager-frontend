import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

function serialize(p: {
  id: string;
  vendorId: string;
  amount: Prisma.Decimal;
  count: number;
  paidAt: Date;
  paidBy: string | null;
  metadata: unknown;
}) {
  return {
    id: p.id,
    vendor_id: p.vendorId,
    amount: p.amount.toString(),
    count: p.count,
    paid_at: p.paidAt.toISOString(),
    paid_by: p.paidBy ?? '',
    metadata: p.metadata ?? {},
  };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const rows = await prisma.vendorPayment.findMany({
      where: { vendorId: params.id },
      orderBy: [{ paidAt: 'desc' }],
    });
    return NextResponse.json({ ok: true, payments: rows.map(serialize) });
  } catch (e) {
    console.error('[GET /api/pm/vendors/:id/payments]', e);
    return NextResponse.json({ ok: false, error: 'Failed to list payments' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
    }

    const exists = await prisma.pmVendor.findUnique({ where: { id: params.id } });
    if (!exists) {
      return NextResponse.json({ ok: false, error: 'Vendor not found' }, { status: 404 });
    }

    const amountRaw = body.amount;
    if (amountRaw == null || isNaN(Number(amountRaw))) {
      return NextResponse.json({ ok: false, error: 'amount required' }, { status: 400 });
    }
    const amountDec = new Prisma.Decimal(String(amountRaw));
    const count = Number.isFinite(Number(body.count)) ? Number(body.count) : 0;
    const paidByRaw = (body.paid_by ?? body.paidBy ?? user.email ?? user.id ?? '').toString().trim();
    const paidBy = paidByRaw || null;
    const metadata =
      body.metadata && typeof body.metadata === 'object' ? (body.metadata as object) : undefined;

    const created = await prisma.vendorPayment.create({
      data: {
        vendorId: params.id,
        amount: amountDec,
        count,
        paidBy,
        metadata,
      },
    });
    return NextResponse.json({ ok: true, payment: serialize(created) });
  } catch (e) {
    console.error('[POST /api/pm/vendors/:id/payments]', e);
    return NextResponse.json({ ok: false, error: 'Failed to record payment' }, { status: 500 });
  }
}
