import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { requireSuperAdmin } from '@/lib/requireSuperAdmin';
import { getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';

export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requireSuperAdmin();
  if (gate.error) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  const user = gate.user;
  if (!user) return NextResponse.json({ ok: false, error: 'Nao autenticado' }, { status: 401 });

  try {
    const scopeUser = toClientScopeUser(user);
    const scopeWhere = getClientScopeWhere(scopeUser) as Prisma.AuditEntryWhereInput;

    const [actionRows, entityRows] = await Promise.all([
      prisma.auditEntry.findMany({
        where: scopeWhere,
        distinct: ['action'],
        select: { action: true },
        orderBy: { action: 'asc' },
      }),
      prisma.auditEntry.findMany({
        where: scopeWhere,
        distinct: ['entity'],
        select: { entity: true },
        orderBy: { entity: 'asc' },
      }),
    ]);

    const actions = actionRows
      .map((r) => r.action)
      .filter((a) => a != null && String(a).trim() !== '');
    const entities = entityRows
      .map((r) => r.entity)
      .filter((e) => e != null && String(e).trim() !== '');

    return NextResponse.json({ ok: true, actions, entities });
  } catch (e) {
    console.error('[GET /api/audit/facets]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
