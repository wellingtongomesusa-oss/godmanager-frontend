import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import {
  getClientScopeForCreate,
  getClientScopeWhere,
  toClientScopeUser,
} from '@/lib/clientScope';
import {
  fetchTenantNamesById,
  leaseContractCode,
  leaseContractToJson,
  parseMoveInDate,
  resolveActiveTenant,
  utcTodayStart,
} from '@/lib/leaseContracts';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const scopeUser = toClientScopeUser(user);

  try {
    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get('propertyId')?.trim() || '';
    if (!propertyId) {
      return NextResponse.json({ ok: false, error: 'propertyId is required' }, { status: 400 });
    }

    const property = await prisma.property.findFirst({
      where: { id: propertyId, ...getClientScopeWhere(scopeUser) },
      select: { id: true },
    });
    if (!property) {
      return NextResponse.json({ ok: false, error: 'Property not found' }, { status: 404 });
    }

    const rows = await prisma.leaseContract.findMany({
      where: {
        propertyId: property.id,
        ...getClientScopeWhere(scopeUser),
      },
      orderBy: { moveIn: 'desc' },
    });

    const tenantMap = await fetchTenantNamesById(
      rows.map((r) => r.tenantId).filter((id): id is string => Boolean(id)),
    );

    return NextResponse.json({
      ok: true,
      contracts: rows.map((c) =>
        leaseContractToJson(c, {
          tenantName: c.tenantId ? tenantMap.get(c.tenantId) ?? null : null,
        }),
      ),
    });
  } catch (e) {
    console.error('[GET /api/lease-contracts]', e);
    return NextResponse.json({ ok: false, error: 'Failed to list lease contracts' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const scopeUser = toClientScopeUser(user);

  try {
    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
    }

    const propertyId = String(body.propertyId ?? '').trim();
    if (!propertyId) {
      return NextResponse.json({ ok: false, error: 'propertyId is required' }, { status: 400 });
    }

    const property = await prisma.property.findFirst({
      where: { id: propertyId, ...getClientScopeWhere(scopeUser) },
      select: { id: true, code: true, clientId: true },
    });
    if (!property) {
      return NextResponse.json({ ok: false, error: 'Property not found' }, { status: 404 });
    }

    const moveInParsed = parseMoveInDate(body.moveIn);
    if (body.moveIn != null && body.moveIn !== '' && moveInParsed === undefined) {
      return NextResponse.json({ ok: false, error: 'Invalid moveIn' }, { status: 400 });
    }
    const moveIn = moveInParsed ?? utcTodayStart();

    const scopedClientId = getClientScopeForCreate(scopeUser);
    const bodyClientId =
      typeof body.clientId === 'string' ? String(body.clientId).trim() : null;
    const clientId = scopedClientId ?? property.clientId ?? bodyClientId ?? null;

    const row = await prisma.$transaction(async (tx) => {
      const activeExisting = await tx.leaseContract.findFirst({
        where: { propertyId: property.id, status: 'active' },
        select: { id: true },
      });
      if (activeExisting) {
        throw Object.assign(new Error('contrato_ativo_existente'), { statusCode: 409 });
      }

      let tenantId: string | null = null;
      const bodyTenantId =
        body.tenantId != null && String(body.tenantId).trim() !== ''
          ? String(body.tenantId).trim()
          : null;

      if (bodyTenantId) {
        const tenant = await tx.tenant.findFirst({
          where: { id: bodyTenantId, propertyId: property.id },
          select: { id: true },
        });
        if (!tenant) {
          throw Object.assign(new Error('tenant_not_found'), { statusCode: 400 });
        }
        tenantId = tenant.id;
      } else {
        const resolved = await resolveActiveTenant(property.id, tx);
        if (resolved.kind === 'none') {
          throw Object.assign(new Error('sem_tenant_ativo'), { statusCode: 400 });
        }
        if (resolved.kind === 'many') {
          throw Object.assign(new Error('multiplos_tenants_ativos'), {
            statusCode: 409,
            candidates: resolved.tenants,
          });
        }
        tenantId = resolved.tenants[0]?.id ?? null;
      }

      const code = await leaseContractCode(property.code, moveIn, tx);
      const notes =
        body.notes != null && String(body.notes).trim() !== ''
          ? String(body.notes).trim()
          : null;

      return tx.leaseContract.create({
        data: {
          ...(clientId ? { clientId } : {}),
          propertyId: property.id,
          tenantId,
          code,
          moveIn,
          status: 'active',
          notes,
          createdById: user.id,
        },
      });
    });

    const tenantName =
      row.tenantId
        ? (await fetchTenantNamesById([row.tenantId])).get(row.tenantId) ?? null
        : null;

    return NextResponse.json(
      { ok: true, contract: leaseContractToJson(row, { tenantName }) },
      { status: 201 },
    );
  } catch (e) {
    const err = e as { statusCode?: number; message?: string; candidates?: unknown };
    if (err?.statusCode === 409 && err.message === 'contrato_ativo_existente') {
      return NextResponse.json({ ok: false, error: 'contrato_ativo_existente' }, { status: 409 });
    }
    if (err?.statusCode === 409 && err.message === 'multiplos_tenants_ativos') {
      return NextResponse.json(
        {
          ok: false,
          error: 'multiplos_tenants_ativos',
          candidates: err.candidates ?? [],
        },
        { status: 409 },
      );
    }
    if (err?.statusCode === 400 && err.message === 'sem_tenant_ativo') {
      return NextResponse.json({ ok: false, error: 'sem_tenant_ativo' }, { status: 400 });
    }
    if (err?.statusCode === 400 && err.message === 'tenant_not_found') {
      return NextResponse.json({ ok: false, error: 'tenant_not_found' }, { status: 400 });
    }
    console.error('[POST /api/lease-contracts]', e);
    return NextResponse.json({ ok: false, error: 'Failed to create lease contract' }, { status: 500 });
  }
}
