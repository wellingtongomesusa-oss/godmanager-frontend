import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { prisma } from '@/lib/db';
import { resolveAuditGlSnapshotClientScope } from '@/lib/audit2026GlSnapshotsScope';

export const dynamic = 'force-dynamic';

type SnapshotTotals = {
  rent?: unknown;
  ownerDist?: unknown;
  mgmtFee?: unknown;
  propertyCount?: unknown;
  pct?: unknown | null;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function coerceTotals(raw: unknown): SnapshotTotals | null {
  if (!isPlainObject(raw)) return null;
  return raw as SnapshotTotals;
}

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

    const rows = await prisma.glAuditSnapshot.findMany({
      where: { clientId: scope.clientId },
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        label: true,
        periodStart: true,
        periodEnd: true,
        uploadedAt: true,
        totalsJson: true,
      },
    });

    const snapshots = rows.map((r) => ({
      id: r.id,
      label: r.label,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      uploadedAt: r.uploadedAt.toISOString(),
      totals: r.totalsJson as SnapshotTotals,
    }));

    return NextResponse.json({ ok: true, snapshots });
  } catch (e) {
    console.error('[audit-2026/snapshots GET]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}

type PostBody = {
  clientId?: string;
  label?: unknown;
  periodStart?: unknown;
  periodEnd?: unknown;
  totals?: unknown;
  monthly?: unknown;
  perProperty?: unknown;
};

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserFromSession();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
    }
    const body = (await req.json().catch(() => ({}))) as PostBody;

    const scope = await resolveAuditGlSnapshotClientScope(user, body.clientId);
    if (!scope.ok) {
      return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
    }

    const label = typeof body.label === 'string' ? body.label.trim().slice(0, 240) || null : null;
    const periodStart =
      typeof body.periodStart === 'string' ? body.periodStart.trim().slice(0, 32) || null : null;
    const periodEnd =
      typeof body.periodEnd === 'string' ? body.periodEnd.trim().slice(0, 32) || null : null;

    const totalsParsed = coerceTotals(body.totals);
    if (!totalsParsed) {
      return NextResponse.json({ ok: false, error: 'Campo totals inválido.' }, { status: 400 });
    }
    if (!Array.isArray(body.monthly) || !Array.isArray(body.perProperty)) {
      return NextResponse.json(
        { ok: false, error: 'monthly e perProperty devem ser listas JSON.' },
        { status: 400 },
      );
    }

    const totalsJson = totalsParsed as unknown as Prisma.InputJsonValue;
    const monthlyJson = body.monthly as Prisma.InputJsonValue;
    const perPropertyJson = body.perProperty as Prisma.InputJsonValue;

    const snap = await prisma.glAuditSnapshot.create({
      data: {
        clientId: scope.clientId,
        uploadedBy: user.email || null,
        label,
        periodStart,
        periodEnd,
        totalsJson,
        monthlyJson,
        perPropertyJson,
      },
      select: { id: true, uploadedAt: true },
    });

    return NextResponse.json({
      ok: true,
      id: snap.id,
      snapshot: { id: snap.id, uploadedAt: snap.uploadedAt.toISOString() },
    });
  } catch (e) {
    console.error('[audit-2026/snapshots POST]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}
