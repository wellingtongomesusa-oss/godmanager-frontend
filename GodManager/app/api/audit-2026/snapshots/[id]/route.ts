import { NextResponse } from 'next/server';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { prisma } from '@/lib/db';
import { resolveAuditGlSnapshotClientScope } from '@/lib/audit2026GlSnapshotsScope';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUserFromSession();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
    }
    const { id } = params;
    if (!id) {
      return NextResponse.json({ ok: false, error: 'Identificador em falta.' }, { status: 400 });
    }

    const url = new URL(req.url);
    const incoming = url.searchParams.get('clientId');
    const scope = await resolveAuditGlSnapshotClientScope(user, incoming);
    if (!scope.ok) {
      return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
    }

    const row = await prisma.glAuditSnapshot.findFirst({
      where: { id, clientId: scope.clientId },
      select: {
        id: true,
        label: true,
        periodStart: true,
        periodEnd: true,
        uploadedAt: true,
        totalsJson: true,
        monthlyJson: true,
        perPropertyJson: true,
      },
    });

    if (!row) {
      return NextResponse.json({ ok: false, error: 'Snapshot não encontrado.' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      id: row.id,
      label: row.label,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      uploadedAt: row.uploadedAt.toISOString(),
      totals: row.totalsJson,
      monthly: row.monthlyJson,
      perProperty: row.perPropertyJson,
    });
  } catch (e) {
    console.error('[audit-2026/snapshots/[id] GET]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUserFromSession();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
    }
    const { id } = params;
    if (!id) {
      return NextResponse.json({ ok: false, error: 'Identificador em falta.' }, { status: 400 });
    }

    const url = new URL(req.url);
    const incoming = url.searchParams.get('clientId');
    const scope = await resolveAuditGlSnapshotClientScope(user, incoming);
    if (!scope.ok) {
      return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
    }

    const del = await prisma.glAuditSnapshot.deleteMany({
      where: { id, clientId: scope.clientId },
    });

    if (del.count === 0) {
      return NextResponse.json({ ok: false, error: 'Snapshot não encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[audit-2026/snapshots/[id] DELETE]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}
