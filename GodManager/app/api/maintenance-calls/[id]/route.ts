import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

type CallWithRelations = Prisma.MaintenanceCallGetPayload<{
  include: {
    tenant: { select: { id: true; code: true; name: true } };
    property: { select: { id: true; code: true; address: true } };
  };
}>;

function serialize(c: CallWithRelations) {
  return {
    id: c.id,
    tenantId: c.tenantId,
    tenant: c.tenant ?? null,
    propertyId: c.propertyId,
    property: c.property ?? null,
    tipo: c.tipo,
    descricao: c.descricao,
    fotoUrl: c.fotoUrl,
    status: c.status,
    isAlert: c.isAlert,
    createdBy: c.createdBy,
    resolvedAt: c.resolvedAt ? c.resolvedAt.toISOString() : null,
    resolvedBy: c.resolvedBy,
    notes: c.notes,
    metadata: c.metadata ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const u = await getCurrentUserFromSession();
  if (!u) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const c = await prisma.maintenanceCall.findUnique({
      where: { id: params.id },
      include: {
        tenant: { select: { id: true, code: true, name: true } },
        property: { select: { id: true, code: true, address: true } },
      },
    });
    if (!c) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, call: serialize(c) });
  } catch (e) {
    console.error('[GET /api/maintenance-calls/:id]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const u = await getCurrentUserFromSession();
  if (!u) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const data: Prisma.MaintenanceCallUpdateInput = {};
    if (typeof body?.tipo === 'string') data.tipo = body.tipo;
    if (typeof body?.descricao === 'string') data.descricao = body.descricao;
    if (typeof body?.fotoUrl === 'string' || body?.fotoUrl === null) data.fotoUrl = body.fotoUrl;
    if (typeof body?.status === 'string') data.status = body.status;
    if (typeof body?.isAlert === 'boolean') data.isAlert = body.isAlert;
    if (typeof body?.notes === 'string' || body?.notes === null) data.notes = body.notes;
    if (body?.metadata && typeof body.metadata === 'object') data.metadata = body.metadata as object;
    if (body?.status === 'resolvido' || body?.resolved === true) {
      data.resolvedAt = new Date();
      data.resolvedBy = u.email || u.id;
    }
    if (body?.tenantId === null) data.tenant = { disconnect: true };
    else if (typeof body?.tenantId === 'string')
      data.tenant = { connect: { id: body.tenantId } };
    if (body?.propertyId === null) data.property = { disconnect: true };
    else if (typeof body?.propertyId === 'string')
      data.property = { connect: { id: body.propertyId } };

    const updated = await prisma.maintenanceCall.update({
      where: { id: params.id },
      data,
      include: {
        tenant: { select: { id: true, code: true, name: true } },
        property: { select: { id: true, code: true, address: true } },
      },
    });
    await prisma.auditEntry
      .create({
        data: {
          actorId: u.id,
          actorEmail: u.email,
          action: 'update',
          entity: 'maintenance_call',
          entityId: params.id,
          details: JSON.stringify({ status: data.status, tipo: data.tipo }),
        },
      })
      .catch(() => {});
    return NextResponse.json({ ok: true, call: serialize(updated) });
  } catch (e) {
    console.error('[PATCH /api/maintenance-calls/:id]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const u = await getCurrentUserFromSession();
  if (!u) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  try {
    await prisma.maintenanceCall.delete({ where: { id: params.id } }).catch(() => {});
    await prisma.auditEntry
      .create({
        data: {
          actorId: u.id,
          actorEmail: u.email,
          action: 'delete',
          entity: 'maintenance_call',
          entityId: params.id,
          details: '',
        },
      })
      .catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[DELETE /api/maintenance-calls/:id]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
