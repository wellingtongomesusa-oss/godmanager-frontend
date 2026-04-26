import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token ?? '').trim();
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Token em falta.' }, { status: 400 });
    }

    const dt = await prisma.demoToken.findUnique({
      where: { token },
      include: { lead: true },
    });
    if (!dt) {
      return NextResponse.json({ ok: false, error: 'Token invalido.' }, { status: 404 });
    }
    if (dt.usedAt) {
      return NextResponse.json({ ok: false, error: 'Token ja foi usado.' }, { status: 410 });
    }
    if (new Date() > dt.expiresAt) {
      return NextResponse.json({ ok: false, error: 'Token expirado.' }, { status: 410 });
    }

    await prisma.demoToken.update({
      where: { id: dt.id },
      data: { usedAt: new Date() },
    });

    await prisma.auditEntry
      .create({
        data: {
          actorId: null,
          actorEmail: dt.lead.email,
          action: 'demo_token_used',
          entity: 'demo_token',
          entityId: dt.id,
          details: JSON.stringify({ leadId: dt.leadId, empresa: dt.lead.empresa }),
        },
      })
      .catch(() => {});

    return NextResponse.json({
      ok: true,
      leadEmail: dt.lead.email,
      leadCompany: dt.lead.empresa,
      leadName: dt.lead.nome,
    });
  } catch (e) {
    console.error('[POST /api/validate-demo-token]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}
