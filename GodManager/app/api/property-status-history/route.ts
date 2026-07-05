import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { canAccessClientId, toClientScopeUser } from '@/lib/clientScope';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

function serialize(e: {
  id: string;
  propertyId: string;
  fromStatus: string | null;
  toStatus: string;
  changedBy: string | null;
  changedByEmail: string | null;
  reason: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
}) {
  return {
    id: e.id,
    propertyId: e.propertyId,
    fromStatus: e.fromStatus,
    toStatus: e.toStatus,
    changedBy: e.changedBy,
    changedByEmail: e.changedByEmail,
    reason: e.reason,
    metadata: e.metadata,
    createdAt: e.createdAt.toISOString(),
  };
}

export async function GET(req: Request) {
  const u = await getCurrentUserFromSession();
  if (!u) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const url = new URL(req.url);
    const propertyId = url.searchParams.get('propertyId');
    const rawLimit = Number(url.searchParams.get('limit'));
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : 200;
    const where: Prisma.PropertyStatusHistoryWhereInput = {};
    if (propertyId) where.propertyId = propertyId;
    // Escopo por tenant via o imovel (property.clientId e sempre populado, mesmo se history.clientId for nulo)
    if (u.role !== 'super_admin') {
      where.property = { clientId: u.clientId ?? '__no_access__' };
    }
    const history = await prisma.propertyStatusHistory.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    });
    return NextResponse.json({ ok: true, history: history.map(serialize) });
  } catch (e) {
    console.error('[GET /api/property-status-history]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const u = await getCurrentUserFromSession();
  if (!u) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const propertyId = String(body?.propertyId || '').trim();
    const toStatus = String(body?.toStatus || '').trim();
    if (!propertyId || !toStatus) {
      return NextResponse.json(
        { ok: false, error: 'propertyId and toStatus required' },
        { status: 400 },
      );
    }
    // Validar que o imovel pertence ao tenant do usuario (bloqueia escrita cross-tenant)
    const prop = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { clientId: true },
    });
    if (!prop) {
      return NextResponse.json({ ok: false, error: 'Property not found' }, { status: 404 });
    }
    if (!canAccessClientId(toClientScopeUser(u), prop.clientId)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }
    const created = await prisma.propertyStatusHistory.create({
      data: {
        propertyId,
        fromStatus: body?.fromStatus ? String(body.fromStatus) : null,
        toStatus,
        changedBy: u.id,
        changedByEmail: u.email,
        reason: body?.reason ? String(body.reason) : null,
        metadata:
          body?.metadata && typeof body.metadata === 'object' ? (body.metadata as object) : undefined,
        clientId: prop.clientId ?? null,
      },
    });
    return NextResponse.json({ ok: true, entry: serialize(created) });
  } catch (e) {
    console.error('[POST /api/property-status-history]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
