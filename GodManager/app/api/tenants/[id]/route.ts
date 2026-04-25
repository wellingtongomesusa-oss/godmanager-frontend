import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

function serialize(t: any) {
  return {
    ...t,
    rent: t.rent.toString(),
    deposit: t.deposit.toString(),
    moveIn: t.moveIn ? t.moveIn.toISOString() : null,
    leaseTo: t.leaseTo ? t.leaseTo.toISOString() : null,
  };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: params.id },
      include: { property: { select: { id: true, code: true, address: true } } },
    });
    if (!tenant) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, tenant: serialize(tenant) });
  } catch (e) {
    console.error('[GET /api/tenants/[id]]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const data: any = {};
    if (body.name !== undefined) data.name = String(body.name);
    if (body.email !== undefined) data.email = body.email || null;
    if (body.phone !== undefined) data.phone = body.phone || null;
    if (body.unit !== undefined) data.unit = body.unit || null;
    if (body.propertyId !== undefined) data.propertyId = body.propertyId || null;
    if (body.moveIn !== undefined) data.moveIn = body.moveIn ? new Date(body.moveIn) : null;
    if (body.leaseTo !== undefined) data.leaseTo = body.leaseTo ? new Date(body.leaseTo) : null;
    if (body.rent !== undefined) data.rent = String(body.rent);
    if (body.deposit !== undefined) data.deposit = String(body.deposit);
    if (body.tenantType !== undefined) data.tenantType = body.tenantType || null;
    if (body.status !== undefined) data.status = body.status;
    if (body.ssn !== undefined) data.ssn = body.ssn || null;
    if (body.itin !== undefined) data.itin = body.itin || null;
    if (body.tags !== undefined) data.tags = Array.isArray(body.tags) ? body.tags : [];
    if (body.notes !== undefined) data.notes = body.notes || null;
    if (body.metadata !== undefined) data.metadata = body.metadata;

    const updated = await prisma.tenant.update({ where: { id: params.id }, data });
    return NextResponse.json({ ok: true, tenant: serialize(updated) });
  } catch (e) {
    console.error('[PATCH /api/tenants/[id]]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  try {
    await prisma.tenant.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[DELETE /api/tenants/[id]]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
