import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';
import {
  fetchTenantNamesById,
  leaseContractToJson,
  parseOptionalMoveOutDate,
  utcTodayStart,
} from '@/lib/leaseContracts';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const scopeUser = toClientScopeUser(user);

  try {
    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
    }

    const existing = await prisma.leaseContract.findFirst({
      where: { id: params.id, ...getClientScopeWhere(scopeUser) },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    if (existing.status !== 'active') {
      return NextResponse.json(
        { ok: false, error: 'contrato_nao_ativo' },
        { status: 409 },
      );
    }

    const moveOutParsed = parseOptionalMoveOutDate(body.moveOut);
    if (body.moveOut != null && body.moveOut !== '' && moveOutParsed === undefined) {
      return NextResponse.json({ ok: false, error: 'Invalid moveOut' }, { status: 400 });
    }
    const moveOut = moveOutParsed ?? utcTodayStart();

    const data: Prisma.LeaseContractUpdateInput = {
      moveOut,
      status: 'ended',
    };
    if (body.notes != null) {
      data.notes = String(body.notes).trim() || null;
    }

    const row = await prisma.leaseContract.update({
      where: { id: existing.id },
      data,
    });

    const tenantName =
      row.tenantId
        ? (await fetchTenantNamesById([row.tenantId])).get(row.tenantId) ?? null
        : null;

    return NextResponse.json({
      ok: true,
      contract: leaseContractToJson(row, { tenantName }),
    });
  } catch (e) {
    console.error('[PATCH /api/lease-contracts/:id]', e);
    return NextResponse.json({ ok: false, error: 'Failed to update lease contract' }, { status: 500 });
  }
}
