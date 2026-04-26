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

export async function GET(req: Request) {
  const u = await getCurrentUserFromSession();
  if (!u) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const tenantId = url.searchParams.get('tenantId');
    const propertyId = url.searchParams.get('propertyId');
    const tipo = url.searchParams.get('tipo');
    const where: Prisma.MaintenanceCallWhereInput = {};
    if (status) where.status = status;
    if (tenantId) where.tenantId = tenantId;
    if (propertyId) where.propertyId = propertyId;
    if (tipo) where.tipo = tipo;
    const calls = await prisma.maintenanceCall.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        tenant: { select: { id: true, code: true, name: true } },
        property: { select: { id: true, code: true, address: true } },
      },
    });
    return NextResponse.json({ ok: true, calls: calls.map(serialize) });
  } catch (e) {
    console.error('[GET /api/maintenance-calls]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const u = await getCurrentUserFromSession();
  if (!u) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const tipo = String(body?.tipo || 'manutencao').trim().slice(0, 80);
    const descricao = String(body?.descricao || '').trim();
    if (!descricao) {
      return NextResponse.json({ ok: false, error: 'descricao required' }, { status: 400 });
    }
    const data: Prisma.MaintenanceCallCreateInput = {
      tipo,
      descricao,
      fotoUrl: body?.fotoUrl ? String(body.fotoUrl) : null,
      status: typeof body?.status === 'string' && body.status ? String(body.status) : 'aberto',
      isAlert: body?.isAlert !== false,
      createdBy: u.email || u.id,
      notes: body?.notes ? String(body.notes) : null,
      metadata:
        body?.metadata && typeof body.metadata === 'object' ? (body.metadata as object) : undefined,
    };
    if (body?.tenantId) data.tenant = { connect: { id: String(body.tenantId) } };
    if (body?.propertyId) data.property = { connect: { id: String(body.propertyId) } };
    const created = await prisma.maintenanceCall.create({
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
          action: 'create',
          entity: 'maintenance_call',
          entityId: created.id,
          details: JSON.stringify({ tipo, descricao: descricao.slice(0, 120) }),
        },
      })
      .catch(() => {});
    return NextResponse.json({ ok: true, call: serialize(created) });
  } catch (e) {
    console.error('[POST /api/maintenance-calls]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
