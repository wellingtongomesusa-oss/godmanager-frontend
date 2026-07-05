import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/requireSuperAdmin';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

/**
 * POST /api/news/broadcast — publica uma "novidade da plataforma" no News de TODOS os clientes.
 * Apenas super_admin. Cria um TeamNewsItem por cliente (clientId e obrigatorio no schema),
 * marcado com subtype 'platform_update' para renderizar com o selo "Novidade".
 */
export async function POST(req: Request) {
  const gate = await requireSuperAdmin();
  if (gate.error) {
    return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  }
  const user = gate.user;
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Nao autenticado' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const title = String(body?.title || '').trim().slice(0, 120);
    const text = body?.body != null ? String(body.body).trim() : '';
    if (!title) {
      return NextResponse.json({ ok: false, error: 'title required' }, { status: 400 });
    }

    const clients = await prisma.client.findMany({ select: { id: true } });
    if (!clients.length) {
      return NextResponse.json({ ok: true, created: 0 });
    }

    await prisma.teamNewsItem.createMany({
      data: clients.map((c) => ({
        clientId: c.id,
        type: 'platform_update',
        subtype: 'platform_update',
        title,
        body: text || null,
        createdById: user.id,
        createdByEmail: user.email,
      })),
    });

    await recordAudit({
      request: req,
      actor: { id: user.id, email: user.email },
      action: 'news.broadcast',
      entity: 'team_news_item',
      entityId: 'broadcast',
      details: `broadcast to ${clients.length} client(s): ${title}`,
    }).catch(() => {});

    return NextResponse.json({ ok: true, created: clients.length });
  } catch (e) {
    console.error('[POST /api/news/broadcast]', e);
    return NextResponse.json({ ok: false, error: 'Failed to broadcast' }, { status: 500 });
  }
}
