import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import type { Prisma } from '@prisma/client';
import { canViewAuditLog } from '@/lib/auditAccess';
import { getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (!canViewAuditLog(user.role)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

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
