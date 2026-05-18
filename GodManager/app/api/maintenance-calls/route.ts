import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import type { Prisma } from '@prisma/client';
import {
  canAccessClientId,
  getClientScopeForCreate,
  getClientScopeWhere,
  toClientScopeUser,
} from '@/lib/clientScope';

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
    clientId: c.clientId,
  };
}

export async function GET(req: Request) {
  const u = await getCurrentUserFromSession();
  if (!u) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const scopeUser = toClientScopeUser(u);
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const tenantId = url.searchParams.get('tenantId');
    const propertyId = url.searchParams.get('propertyId');
    const tipo = url.searchParams.get('tipo');
    const where: Prisma.MaintenanceCallWhereInput = {
      ...getClientScopeWhere(scopeUser),
    };
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
    const scopeUser = toClientScopeUser(u);
    const tipo = String(body?.tipo || 'manutencao').trim().slice(0, 80);
    const descricao = String(body?.descricao || '').trim();
    if (!descricao) {
      return NextResponse.json({ ok: false, error: 'descricao required' }, { status: 400 });
    }

    if (body?.tenantId) {
      const t = await prisma.tenant.findUnique({
        where: { id: String(body.tenantId) },
        select: { clientId: true },
      });
      if (!t) {
        return NextResponse.json({ ok: false, error: 'tenant not found' }, { status: 404 });
      }
      if (!canAccessClientId(scopeUser, t.clientId)) {
        return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
      }
    }
    if (body?.propertyId) {
      const p = await prisma.property.findUnique({
        where: { id: String(body.propertyId) },
        select: { clientId: true },
      });
      if (!p) {
        return NextResponse.json({ ok: false, error: 'property not found' }, { status: 404 });
      }
      if (!canAccessClientId(scopeUser, p.clientId)) {
        return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
      }
    }

    let clientId: string | null = getClientScopeForCreate(scopeUser);
    if (clientId === null && u.role === 'super_admin') {
      const raw = (body as { clientId?: unknown }).clientId;
      clientId = raw != null && String(raw).trim() !== '' ? String(raw).trim() : null;
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
      ...(clientId ? { client: { connect: { id: clientId } } } : {}),
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
