import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@]+$/;

function ipFromHeaders(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip');
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const nome = String(body.nome ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const telefone = String(body.telefone ?? '').trim();
    const empresa = body.empresa ? String(body.empresa).trim() : null;
    const tipoContacto = String(body.tipoContacto ?? 'pessoal');
    const mensagem = body.mensagem ? String(body.mensagem).trim() : null;

    if (!nome || !email || !telefone) {
      return NextResponse.json({ ok: false, error: 'Campos obrigatorios em falta' }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: 'Email invalido' }, { status: 400 });
    }
    if (tipoContacto !== 'pessoal' && tipoContacto !== 'empresa') {
      return NextResponse.json({ ok: false, error: 'tipo invalido' }, { status: 400 });
    }
    if (tipoContacto === 'empresa' && !empresa) {
      return NextResponse.json(
        { ok: false, error: 'Indique o nome da empresa.' },
        { status: 400 },
      );
    }

    const ip = ipFromHeaders(req);
    const userAgent = req.headers.get('user-agent');

    const lead = await prisma.contactLead.create({
      data: {
        nome: nome.slice(0, 200),
        email: email.slice(0, 200),
        telefone: telefone.slice(0, 60),
        empresa: empresa ? empresa.slice(0, 200) : null,
        tipoContacto,
        mensagem: mensagem ? mensagem.slice(0, 8000) : null,
        ip,
        userAgent: userAgent ? userAgent.slice(0, 500) : null,
      },
    });

    await prisma.auditEntry
      .create({
        data: {
          actorId: null,
          actorEmail: email,
          action: 'contact_request',
          entity: 'contact_lead',
          entityId: lead.id,
          details: JSON.stringify({ nome, empresa, tipoContacto }),
          ip,
          userAgent: userAgent ? userAgent.slice(0, 500) : null,
        },
      })
      .catch(() => {});

    return NextResponse.json({ ok: true, id: lead.id });
  } catch (e) {
    console.error('[POST contacto]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno' }, { status: 500 });
  }
}
