import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';
import { fetchPropertySnapshots, hoaChargeToJson } from '@/lib/hoaBilling';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const scopeUser = toClientScopeUser(user);

  try {
    const row = await prisma.hoaCharge.findFirst({
      where: { id: params.id, ...getClientScopeWhere(scopeUser) },
      include: { installments: { orderBy: { seq: 'asc' } } },
    });
    if (!row) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    const propMap = await fetchPropertySnapshots(
      scopeUser,
      row.propertyId ? [row.propertyId] : [],
    );

    return NextResponse.json({
      ok: true,
      charge: hoaChargeToJson(row, {
        property: row.propertyId ? propMap.get(row.propertyId) ?? null : null,
      }),
    });
  } catch (e) {
    console.error('[GET /api/billing/hoa/:id]', e);
    return NextResponse.json({ ok: false, error: 'Failed to get HOA charge' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const scopeUser = toClientScopeUser(user);

  try {
    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
    }

    const existing = await prisma.hoaCharge.findFirst({
      where: { id: params.id, ...getClientScopeWhere(scopeUser) },
      include: { installments: { orderBy: { seq: 'asc' } } },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    const data: Prisma.HoaChargeUpdateInput = {};

    if (body.hoaName != null) {
      data.hoaName = String(body.hoaName).trim() || null;
    }
    if (body.debtorName != null) {
      data.debtorName = String(body.debtorName).trim() || null;
    }
    if (body.notes != null) {
      data.notes = String(body.notes).trim() || null;
    }
    if (body.status != null) {
      const st = String(body.status).trim().toLowerCase();
      if (!['active', 'paid', 'cancelled'].includes(st)) {
        return NextResponse.json({ ok: false, error: 'Invalid status' }, { status: 400 });
      }
      data.status = st;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: 'No valid fields to update' }, { status: 400 });
    }

    const row = await prisma.hoaCharge.update({
      where: { id: existing.id },
      data,
      include: { installments: { orderBy: { seq: 'asc' } } },
    });

    const propMap = await fetchPropertySnapshots(
      scopeUser,
      row.propertyId ? [row.propertyId] : [],
    );

    return NextResponse.json({
      ok: true,
      charge: hoaChargeToJson(row, {
        property: row.propertyId ? propMap.get(row.propertyId) ?? null : null,
      }),
    });
  } catch (e) {
    console.error('[PATCH /api/billing/hoa/:id]', e);
    return NextResponse.json({ ok: false, error: 'Failed to update HOA charge' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const scopeUser = toClientScopeUser(user);

  try {
    const existing = await prisma.hoaCharge.findFirst({
      where: { id: params.id, ...getClientScopeWhere(scopeUser) },
      include: { installments: { select: { paid: true } } },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    if (existing.installments.some((i) => i.paid)) {
      return NextResponse.json(
        { ok: false, error: 'tem parcelas pagas' },
        { status: 409 },
      );
    }

    await prisma.hoaCharge.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[DELETE /api/billing/hoa/:id]', e);
    return NextResponse.json({ ok: false, error: 'Failed to delete HOA charge' }, { status: 500 });
  }
}
