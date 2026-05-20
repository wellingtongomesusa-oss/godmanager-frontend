import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { prisma } from '@/lib/db';
import { resolveAuditGlSnapshotClientScope } from '@/lib/audit2026GlSnapshotsScope';

export const dynamic = 'force-dynamic';

type ResultRow = {
  propertyKey?: unknown;
  valorOwner?: unknown;
  feeEsperado?: unknown;
  feeCobrado?: unknown;
  pctContratada?: unknown;
  pctAplicada?: unknown;
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

    const row = await prisma.feeAuditSnapshot.findFirst({
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
    console.error('[audit-2026/fee-snapshots GET]', e);
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
        valorOwner:
          typeof r.valorOwner === 'number' && Number.isFinite(r.valorOwner)
            ? r.valorOwner
            : null,
        feeEsperado:
          typeof r.feeEsperado === 'number' && Number.isFinite(r.feeEsperado)
            ? r.feeEsperado
            : null,
        feeCobrado:
          typeof r.feeCobrado === 'number' && Number.isFinite(r.feeCobrado)
            ? r.feeCobrado
            : null,
        pctContratada:
          typeof r.pctContratada === 'number' && Number.isFinite(r.pctContratada)
            ? r.pctContratada
            : null,
        pctAplicada:
          typeof r.pctAplicada === 'number' && Number.isFinite(r.pctAplicada)
            ? r.pctAplicada
            : null,
      });
    }

    if (!cleaned.length) {
      return NextResponse.json({ ok: false, error: 'Nenhuma linha result válida.' }, { status: 400 });
    }

    const resultsJson = cleaned as unknown as Prisma.InputJsonValue;
    const email = user.email?.trim().slice(0, 254) || null;

    const created = await prisma.feeAuditSnapshot.create({
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
    console.error('[audit-2026/fee-snapshots POST]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}
