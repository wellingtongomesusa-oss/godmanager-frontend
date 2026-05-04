import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { normalizePropertyMetadata } from '@/lib/photoMetadata';
import {
  getClientScopeForCreate,
  getClientScopeWhere,
  toClientScopeUser,
} from '@/lib/clientScope';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const scopeUser = toClientScopeUser(user);
    const properties = await prisma.property.findMany({
      where: getClientScopeWhere(scopeUser),
      orderBy: [{ code: 'asc' }],
    });
    return NextResponse.json({
      ok: true,
      properties: properties.map((p) => ({
        ...p,
        rent: p.rent.toString(),
        deposit: p.deposit.toString(),
        mgmtFeePct: p.mgmtFeePct.toString(),
        guaranteeLimit: p.guaranteeLimit != null ? p.guaranteeLimit.toString() : null,
        moveInDate: p.moveInDate ? p.moveInDate.toISOString() : null,
      })),
    });
  } catch (e) {
    console.error('[GET /api/properties]', e);
    return NextResponse.json({ ok: false, error: 'Failed to list properties' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
    }

    const code = String(body.code || '').trim();
    const address = String(body.address || '').trim();
    if (!code || !address) {
      return NextResponse.json({ ok: false, error: 'code and address required' }, { status: 400 });
    }

    const existing = await prisma.property.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ ok: false, error: 'code already exists' }, { status: 409 });
    }

    const scopeUser = toClientScopeUser(user);
    const scopedCreate = getClientScopeForCreate(scopeUser);
    let clientId: string | null = scopedCreate;
    if (scopedCreate === null && user.role === 'super_admin') {
      const raw = (body as { clientId?: unknown }).clientId;
      clientId =
        raw != null && String(raw).trim() !== '' ? String(raw).trim() : null;
    }

    const created = await prisma.property.create({
      data: {
        code,
        address,
        city: body.city || null,
        state: body.state || null,
        zip: body.zip || null,
        unitType: body.unitType || body.type || null,
        bedrooms: body.bedrooms != null ? Number(body.bedrooms) : null,
        bathrooms: body.bathrooms != null ? Number(body.bathrooms) : null,
        rent: body.rent != null ? String(body.rent) : '0',
        deposit: body.deposit != null ? String(body.deposit) : '0',
        guaranteeLimit: body.guaranteeLimit != null && body.guaranteeLimit !== ''
          ? String(body.guaranteeLimit)
          : null,
        moveInDate: body.moveInDate ? new Date(String(body.moveInDate)) : null,
        ownerName: body.ownerName || body.owner || null,
        ownerEmail: body.ownerEmail || null,
        ownerPhone: body.ownerPhone || null,
        mgmtFeePct: body.mgmtFeePct != null ? String(body.mgmtFeePct) : '0',
        status: body.status || 'active',
        notes: body.notes || null,
        metadata: (normalizePropertyMetadata(body.metadata) ??
          undefined) as Prisma.InputJsonValue | undefined,
        createdBy: user.id,
        clientId,
      },
    });

    return NextResponse.json({
      ok: true,
      property: {
        ...created,
        rent: created.rent.toString(),
        deposit: created.deposit.toString(),
        mgmtFeePct: created.mgmtFeePct.toString(),
        guaranteeLimit: created.guaranteeLimit != null ? created.guaranteeLimit.toString() : null,
        moveInDate: created.moveInDate ? created.moveInDate.toISOString() : null,
      },
    });
  } catch (e) {
    console.error('[POST /api/properties]', e);
    return NextResponse.json({ ok: false, error: 'Failed to create property' }, { status: 500 });
  }
}
