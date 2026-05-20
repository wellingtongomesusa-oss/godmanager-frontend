import { NextResponse } from 'next/server';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { prisma } from '@/lib/db';
import { resolveAuditGlSnapshotClientScope } from '@/lib/audit2026GlSnapshotsScope';

export const dynamic = 'force-dynamic';

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

    const rows = await prisma.mgmtFeeContract.findMany({
      where: { clientId: scope.clientId },
      orderBy: { propertyKey: 'asc' },
      select: {
        propertyKey: true,
        contractedPct: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, contracts: rows });
  } catch (e) {
    console.error('[audit-2026/fee-contracts GET]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}

type PostContract = {
  propertyKey?: unknown;
  contractedPct?: unknown;
};

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserFromSession();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      clientId?: string;
      contracts?: unknown;
    };

    const scope = await resolveAuditGlSnapshotClientScope(user, body.clientId);
    if (!scope.ok) {
      return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
    }

    const arr = Array.isArray(body.contracts) ? body.contracts : [];
    if (arr.length === 0) {
      return NextResponse.json({ ok: false, error: 'Lista contracts vazia.' }, { status: 400 });
    }

    const email = user.email?.trim().slice(0, 254) || null;
    let count = 0;

    await prisma.$transaction(async (tx) => {
      for (const item of arr as PostContract[]) {
        const key =
          typeof item.propertyKey === 'string'
            ? item.propertyKey.trim().slice(0, 4000)
            : '';
        if (!key) continue;

        const pctNum =
          typeof item.contractedPct === 'number'
            ? item.contractedPct
            : typeof item.contractedPct === 'string'
              ? parseFloat(String(item.contractedPct).trim().replace(',', '.'))
              : NaN;

        if (!Number.isFinite(pctNum) || pctNum < 0 || pctNum > 100) {
          continue;
        }

        await tx.mgmtFeeContract.upsert({
          where: {
            clientId_propertyKey: { clientId: scope.clientId, propertyKey: key },
          },
          create: {
            clientId: scope.clientId,
            propertyKey: key,
            contractedPct: pctNum,
            updatedBy: email,
          },
          update: {
            contractedPct: pctNum,
            updatedBy: email,
          },
        });
        count += 1;
      }
    });

    return NextResponse.json({ ok: true, saved: count });
  } catch (e) {
    console.error('[audit-2026/fee-contracts POST]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}
