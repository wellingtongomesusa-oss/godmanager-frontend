import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const tenants = await prisma.tenant.findMany({
      orderBy: [{ code: 'asc' }],
      include: { property: { select: { id: true, code: true, address: true } } },
    });
    return NextResponse.json({
      ok: true,
      tenants: tenants.map((t) => ({
        ...t,
        rent: t.rent.toString(),
        deposit: t.deposit.toString(),
        moveIn: t.moveIn ? t.moveIn.toISOString() : null,
        leaseTo: t.leaseTo ? t.leaseTo.toISOString() : null,
      })),
    });
  } catch (e) {
    console.error('[GET /api/tenants]', e);
    return NextResponse.json({ ok: false, error: 'Failed to list tenants' }, { status: 500 });
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
    const name = String(body.name || '').trim();
    if (!code || !name) {
      return NextResponse.json({ ok: false, error: 'code and name required' }, { status: 400 });
    }

    const existing = await prisma.tenant.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ ok: false, error: 'code already exists' }, { status: 409 });
    }

    const created = await prisma.tenant.create({
      data: {
        code,
        name,
        email: body.email || null,
        phone: body.phone || null,
        unit: body.unit || null,
        propertyId: body.propertyId || null,
        moveIn: body.moveIn ? new Date(body.moveIn) : null,
        leaseTo: body.leaseTo ? new Date(body.leaseTo) : null,
        rent: body.rent != null ? String(body.rent) : '0',
        deposit: body.deposit != null ? String(body.deposit) : '0',
        tenantType: body.tenantType || null,
        status: body.status || 'active',
        ssn: body.ssn || null,
        itin: body.itin || null,
        tags: Array.isArray(body.tags) ? body.tags : [],
        notes: body.notes || null,
        metadata: body.metadata ?? undefined,
        createdBy: user.id,
      },
    });

    return NextResponse.json({
      ok: true,
      tenant: {
        ...created,
        rent: created.rent.toString(),
        deposit: created.deposit.toString(),
        moveIn: created.moveIn ? created.moveIn.toISOString() : null,
        leaseTo: created.leaseTo ? created.leaseTo.toISOString() : null,
      },
    });
  } catch (e) {
    console.error('[POST /api/tenants]', e);
    return NextResponse.json({ ok: false, error: 'Failed to create tenant' }, { status: 500 });
  }
}
