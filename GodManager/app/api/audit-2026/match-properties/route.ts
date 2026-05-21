import { NextResponse } from 'next/server';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { prisma } from '@/lib/db';
import { resolveAuditGlSnapshotClientScope } from '@/lib/audit2026GlSnapshotsScope';
import { matchPropertyWithMeta } from '@/lib/tenantPaymentMatcher';

export const dynamic = 'force-dynamic';

const MAX_KEYS = 500;
const SEM_OWNER = '(sem owner)';

function resolveOwnerFields(
  row: {
    ownerName: string | null;
    ownerEmail: string | null;
    owner: { name: string; email: string | null } | null;
  } | undefined,
): { ownerName: string; ownerEmail: string | null } {
  if (!row) {
    return { ownerName: SEM_OWNER, ownerEmail: null };
  }
  const propName = (row.ownerName || '').trim();
  if (propName) {
    return {
      ownerName: propName,
      ownerEmail: (row.ownerEmail || '').trim() || null,
    };
  }
  const linkedName = (row.owner?.name || '').trim();
  if (linkedName) {
    return {
      ownerName: linkedName,
      ownerEmail: (row.ownerEmail || row.owner?.email || '').trim() || null,
    };
  }
  return { ownerName: SEM_OWNER, ownerEmail: null };
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserFromSession();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      clientId?: string;
      propertyKeys?: unknown;
    };

    const scope = await resolveAuditGlSnapshotClientScope(user, body.clientId);
    if (!scope.ok) {
      return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
    }

    const rawKeys = Array.isArray(body.propertyKeys) ? body.propertyKeys : [];
    const propertyKeys: string[] = [];
    for (const item of rawKeys) {
      if (typeof item !== 'string') continue;
      const k = item.trim();
      if (!k || propertyKeys.includes(k)) continue;
      propertyKeys.push(k);
      if (propertyKeys.length >= MAX_KEYS) break;
    }

    const dbProps = await prisma.property.findMany({
      where: { clientId: scope.clientId },
      select: {
        id: true,
        address: true,
        mgmtFeePct: true,
        hoaAdmin: true,
        ownerName: true,
        ownerEmail: true,
        owner: {
          select: { name: true, email: true },
        },
      },
      orderBy: { address: 'asc' },
    });

    const lite = dbProps.map((p) => ({ id: p.id, address: p.address }));
    const byId = new Map(dbProps.map((p) => [p.id, p]));

    const results = propertyKeys.map((propertyKey) => {
      const meta = matchPropertyWithMeta(propertyKey, lite);
      if (!meta) {
        return {
          propertyKey,
          matched: false,
          propertyId: null,
          propertyAddress: null,
          mgmtFeePct: null,
          hoaAdmin: false,
          ownerName: null,
          ownerEmail: null,
          score: null,
          method: null,
        };
      }
      const row = byId.get(meta.propertyId);
      const pctNum = row ? Number(row.mgmtFeePct) : 0;
      const owner = resolveOwnerFields(row);
      return {
        propertyKey,
        matched: true,
        propertyId: meta.propertyId,
        propertyAddress: row?.address ?? null,
        mgmtFeePct: Number.isFinite(pctNum) ? pctNum : 0,
        hoaAdmin: row?.hoaAdmin ?? false,
        ownerName: owner.ownerName,
        ownerEmail: owner.ownerEmail,
        score: meta.score,
        method: meta.method,
      };
    });

    return NextResponse.json({
      ok: true,
      clientId: scope.clientId,
      propertyCount: dbProps.length,
      results,
    });
  } catch (e) {
    console.error('[audit-2026/match-properties POST]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}
