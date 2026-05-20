import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { prisma } from '@/lib/db';
import { resolveAuditGlSnapshotClientScope } from '@/lib/audit2026GlSnapshotsScope';

export const dynamic = 'force-dynamic';

type ResultRow = {
  propertyKey?: unknown;
  owner?: unknown;
  overPayment?: unknown;
  netDevido?: unknown;
  distribuido?: unknown;
  feeDevido?: unknown;
};

export async function GET(req: Request) {
  try {
    const user = await getCurrentUserFromSession();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
    }
    const url = new URL(req.url);
    const incoming = url.searchParams.get('clientId');
    const scope = await resolveAuditGlSnapshotClientScope(user, incoming);
    if (!scope.ok) {
      return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
    }

    const row = await prisma.ownerAuditSnapshot.findFirst({
      where: { clientId: scope.clientId },
      orderBy: { capturedAt: 'desc' },
      select: {
        id: true,
        label: true,
        capturedAt: true,
        resultsJson: true,
      },
    });

    return NextResponse.json({
      ok: true,
      snapshot: row
        ? {
            id: row.id,
            label: row.label,
            capturedAt: row.capturedAt.toISOString(),
            results: row.resultsJson,
          }
        : null,
    });
  } catch (e) {
    console.error('[audit-2026/owner-snapshots GET]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserFromSession();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      clientId?: string;
      label?: unknown;
      results?: unknown;
    };

    const scope = await resolveAuditGlSnapshotClientScope(user, body.clientId);
    if (!scope.ok) {
      return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
    }

    const label = typeof body.label === 'string' ? body.label.trim().slice(0, 240) || null : null;
    const arr = Array.isArray(body.results) ? body.results : null;
    if (!arr?.length) {
      return NextResponse.json({ ok: false, error: 'Lista results vazia.' }, { status: 400 });
    }

    const cleaned: Record<string, unknown>[] = [];

    for (const r of arr as ResultRow[]) {
      const pk =
        typeof r.propertyKey === 'string'
          ? r.propertyKey.trim().slice(0, 4000)
          : '';
      if (!pk) continue;

      cleaned.push({
        propertyKey: pk,
        owner: typeof r.owner === 'string' ? r.owner.trim().slice(0, 500) || null : null,
        overPayment:
          typeof r.overPayment === 'number' && Number.isFinite(r.overPayment)
            ? r.overPayment
            : null,
        netDevido:
          typeof r.netDevido === 'number' && Number.isFinite(r.netDevido)
            ? r.netDevido
            : null,
        distribuido:
          typeof r.distribuido === 'number' && Number.isFinite(r.distribuido)
            ? r.distribuido
            : null,
        feeDevido:
          typeof r.feeDevido === 'number' && Number.isFinite(r.feeDevido)
            ? r.feeDevido
            : null,
      });
    }

    if (!cleaned.length) {
      return NextResponse.json({ ok: false, error: 'Nenhuma linha results válida.' }, { status: 400 });
    }

    const resultsJson = cleaned as unknown as Prisma.InputJsonValue;
    const email = user.email?.trim().slice(0, 254) || null;

    const created = await prisma.ownerAuditSnapshot.create({
      data: {
        clientId: scope.clientId,
        capturedBy: email,
        label,
        resultsJson,
      },
      select: { id: true, capturedAt: true },
    });

    return NextResponse.json({
      ok: true,
      id: created.id,
      capturedAt: created.capturedAt.toISOString(),
    });
  } catch (e) {
    console.error('[audit-2026/owner-snapshots POST]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}
