import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { generateDownloadUrl } from '@/lib/r2';

export const dynamic = 'force-dynamic';

/**
 * GET /api/contracts?clientId=
 * Lista as casas do cliente com o contrato atual (arquivo) e o inquilino atual.
 * Central simples de contratos: 1 contrato por casa, vinculado à casa + inquilino atual.
 * super_admin escolhe a empresa (clientId); admin/manager usa a própria.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });

  const role = String(user.role || '').toLowerCase();
  if (!['super_admin', 'admin', 'manager'].includes(role)) {
    return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const qClient = (searchParams.get('clientId') || '').trim();

  let clientId: string;
  if (role === 'super_admin') {
    clientId = qClient || (user.clientId || '');
    if (!clientId) {
      // sem empresa escolhida: devolve vazio (a tela mostra o seletor de empresa)
      return NextResponse.json({ ok: true, clientId: null, properties: [] });
    }
  } else {
    if (!user.clientId) {
      return NextResponse.json({ ok: false, error: 'Utilizador sem empresa.' }, { status: 400 });
    }
    clientId = user.clientId;
    if (qClient && qClient !== clientId) {
      return NextResponse.json({ ok: false, error: 'Acesso negado a outra empresa.' }, { status: 403 });
    }
  }

  try {
    const properties = await prisma.property.findMany({
      where: { clientId },
      orderBy: [{ code: 'asc' }],
      select: {
        id: true,
        code: true,
        address: true,
        tenants: {
          where: { status: { in: ['active', 'notice'] } },
          orderBy: { name: 'asc' },
          select: { name: true },
        },
      },
    });
    const propIds = properties.map((p) => p.id);

    const contracts = propIds.length
      ? await prisma.propertyContract.findMany({
          where: { clientId, propertyId: { in: propIds } },
          orderBy: { updatedAt: 'desc' },
        })
      : [];
    const byProp = new Map<string, (typeof contracts)[0]>();
    for (const c of contracts) if (!byProp.has(c.propertyId)) byProp.set(c.propertyId, c);

    const out = await Promise.all(
      properties.map(async (p) => {
        const c = byProp.get(p.id) || null;
        let contract = null;
        if (c) {
          let viewUrl: string | null = null;
          let downloadUrl: string | null = null;
          try {
            viewUrl = await generateDownloadUrl(c.fileKey, undefined, 300);
            downloadUrl = await generateDownloadUrl(c.fileKey, c.fileName, 300);
          } catch {
            /* links ficam null */
          }
          contract = {
            fileName: c.fileName,
            fileSize: c.fileSize,
            uploadedAt: c.updatedAt.toISOString(),
            viewUrl,
            downloadUrl,
          };
        }
        return {
          propertyId: p.id,
          code: p.code,
          address: p.address,
          tenantName: p.tenants.map((t) => t.name).filter(Boolean).join(' & ') || null,
          contract,
          hasContract: !!c,
        };
      }),
    );

    return NextResponse.json({ ok: true, clientId, properties: out });
  } catch (e) {
    console.error('[GET /api/contracts]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}
