import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { computeKpis, type SophiaKpis } from '@/lib/sophiaKpis';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/index?secret=CRON_SECRET
 * Leitura diária automática da SophIA: recalcula os KPIs de cada cliente e grava
 * um snapshot (a "indexação"). Chamado por um cron diário (Railway/externo).
 *
 * Também aceita super_admin logado (para rodar manualmente).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret');
  const expected = process.env.CRON_SECRET;

  let authorized = false;
  if (expected && secret && secret === expected) {
    authorized = true;
  } else {
    const user = await getCurrentUserFromSession();
    if (user && String(user.role || '').toLowerCase() === 'super_admin') authorized = true;
  }
  if (!authorized) {
    return NextResponse.json({ ok: false, error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const clients = await prisma.client.findMany({ select: { id: true, companyName: true } });
    const results: Array<{ clientId: string; companyName: string; kpis: SophiaKpis }> = [];

    for (const c of clients) {
      const kpis = await computeKpis(c.id);
      await prisma.sophiaSnapshot.upsert({
        where: { clientId: c.id },
        create: { clientId: c.id, kpis: kpis as unknown as Prisma.InputJsonValue, indexedAt: new Date() },
        update: { kpis: kpis as unknown as Prisma.InputJsonValue, indexedAt: new Date() },
      });
      results.push({ clientId: c.id, companyName: c.companyName, kpis });
    }

    return NextResponse.json({ ok: true, indexed: results.length, clients: results });
  } catch (e) {
    console.error('[ai/index] cron error:', e);
    return NextResponse.json({ ok: false, error: 'Erro ao indexar.' }, { status: 500 });
  }
}
