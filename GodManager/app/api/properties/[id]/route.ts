import { NextResponse } from 'next/server';
import type { Property } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { normalizePropertyMetadata } from '@/lib/photoMetadata';
import { canAccessClientId, toClientScopeUser } from '@/lib/clientScope';

export const dynamic = 'force-dynamic';

function serialize(p: Property) {
  return {
    ...p,
    rent: p.rent.toString(),
    deposit: p.deposit.toString(),
    mgmtFeePct: p.mgmtFeePct.toString(),
    guaranteeLimit: p.guaranteeLimit != null ? p.guaranteeLimit.toString() : null,
    moveInDate: p.moveInDate ? p.moveInDate.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const p = await prisma.property.findUnique({ where: { id: params.id } });
    if (!p) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    const scopeUser = toClientScopeUser(user);
    if (!canAccessClientId(scopeUser, p.clientId)) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }
    return NextResponse.json({ ok: true, property: serialize(p) });
  } catch (e) {
    console.error('[GET /api/properties/:id]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const existing = await prisma.property.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    const scopeUser = toClientScopeUser(user);
    if (!canAccessClientId(scopeUser, existing.clientId)) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const data: Prisma.PropertyUpdateInput = {};
    if (body.address !== undefined) data.address = String(body.address);
    if (body.city !== undefined) data.city = (body.city as string) || null;
    if (body.state !== undefined) data.state = (body.state as string) || null;
    if (body.zip !== undefined) data.zip = (body.zip as string) || null;
    if (body.unitType !== undefined || body.type !== undefined) {
      data.unitType = ((body.unitType ?? body.type) as string) || null;
    }
    if (body.bedrooms !== undefined) {
      data.bedrooms = body.bedrooms != null ? Number(body.bedrooms) : null;
    }
    if (body.bathrooms !== undefined) {
      data.bathrooms = body.bathrooms != null ? Number(body.bathrooms) : null;
    }
    if (body.rent !== undefined) data.rent = String(body.rent);
    if (body.deposit !== undefined) data.deposit = String(body.deposit);
    if (body.guaranteeLimit !== undefined) {
      data.guaranteeLimit = body.guaranteeLimit != null && body.guaranteeLimit !== ''
        ? String(body.guaranteeLimit)
        : null;
    }
    if (body.moveInDate !== undefined) {
      data.moveInDate = body.moveInDate ? new Date(String(body.moveInDate)) : null;
    }
    if (body.ownerName !== undefined) data.ownerName = (body.ownerName as string) || null;
    if (body.ownerEmail !== undefined) data.ownerEmail = (body.ownerEmail as string) || null;
    if (body.ownerPhone !== undefined) data.ownerPhone = (body.ownerPhone as string) || null;
    if (body.mgmtFeePct !== undefined) data.mgmtFeePct = String(body.mgmtFeePct);
    if (body.status !== undefined) data.status = String(body.status);
    if (body.notes !== undefined) data.notes = (body.notes as string) || null;
    if (body.metadata !== undefined) {
      const normalized = normalizePropertyMetadata(body.metadata);
      data.metadata = (normalized ?? Prisma.JsonNull) as Prisma.InputJsonValue;
    }

    const updated = await prisma.property.update({ where: { id: params.id }, data });
    return NextResponse.json({ ok: true, property: serialize(updated) });
  } catch (e) {
    console.error('[PATCH /api/properties/:id]', e);
    return NextResponse.json({ ok: false, error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const existing = await prisma.property.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    const scopeUser = toClientScopeUser(user);
    if (!canAccessClientId(scopeUser, existing.clientId)) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    await prisma.property.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as { code?: string };
    if (err?.code === 'P2025') {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }
    console.error('[DELETE /api/properties/:id]', e);
    return NextResponse.json({ ok: false, error: 'Failed to delete' }, { status: 500 });
  }
}
