import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

/**
 * GET /api/owner/statements
 * Lista TODOS os demonstrativos (owner statements) FECHADOS do proprietário logado,
 * agrupados por imóvel e mês (mais recentes primeiro). Somente leitura.
 */
export async function GET() {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const isOwner = user.role === 'owner' && !!user.ownerId;
  const isSuperAdmin = user.role === 'super_admin';
  if (!isOwner && !isSuperAdmin) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  try {
    // imóveis do owner (super_admin sem ownerId não lista nada aqui — usa o painel do gestor)
    const propertyWhere = isOwner ? { ownerId: user.ownerId as string } : { ownerId: user.ownerId ?? '__none__' };
    const properties = await prisma.property.findMany({
      where: propertyWhere,
      select: { id: true, code: true, address: true },
    });
    if (!properties.length) return NextResponse.json({ ok: true, statements: [] });

    const byId = new Map(properties.map((p) => [p.id, p]));
    const payouts = await prisma.ownerMonthPayout.findMany({
      where: { propertyId: { in: properties.map((p) => p.id) }, closedAt: { not: null } },
      orderBy: [{ yearMonth: 'desc' }],
      select: {
        id: true,
        propertyId: true,
        yearMonth: true,
        netPayout: true,
        closedAt: true,
        paidAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      statements: payouts.map((p) => {
        const prop = byId.get(p.propertyId);
        return {
          id: p.id,
          propertyId: p.propertyId,
          propertyCode: prop?.code ?? null,
          address: prop?.address ?? '',
          period: p.yearMonth,
          netPayout: p.netPayout?.toString() ?? '0',
          closedAt: p.closedAt?.toISOString() ?? null,
          paidAt: p.paidAt?.toISOString() ?? null,
        };
      }),
    });
  } catch (e) {
    console.error('[GET /api/owner/statements]', e);
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
}
