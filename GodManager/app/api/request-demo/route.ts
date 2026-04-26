import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutos
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/.+/i;

function ipFromHeaders(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip');
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const nome = String(body?.nome ?? '').trim();
    const empresa = String(body?.empresa ?? '').trim();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const telefone = String(body?.telefone ?? '').trim();
    const redeSocial = body?.redeSocial ? String(body.redeSocial).trim().slice(0, 200) : null;
    const siteEmpresaRaw = body?.siteEmpresa ? String(body.siteEmpresa).trim() : '';
    const siteEmpresa = siteEmpresaRaw
      ? siteEmpresaRaw.match(URL_RE)
        ? siteEmpresaRaw.slice(0, 300)
        : ('https://' + siteEmpresaRaw).slice(0, 300)
      : null;

    if (!nome || !empresa || !email || !telefone) {
      return NextResponse.json({ ok: false, code: 'MISSING_FIELDS' }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, code: 'INVALID_EMAIL' }, { status: 400 });
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await prisma.demoLead.count({
      where: {
        email,
        createdAt: { gte: oneDayAgo },
      },
    });
    if (recentCount >= 3) {
      return NextResponse.json({ ok: false, code: 'RATE_LIMIT' }, { status: 429 });
    }

    const ip = ipFromHeaders(req);
    const userAgent = req.headers.get('user-agent');

    const lead = await prisma.demoLead.create({
      data: {
        nome: nome.slice(0, 120),
        empresa: empresa.slice(0, 160),
        email: email.slice(0, 200),
        telefone: telefone.slice(0, 60),
        redeSocial,
        siteEmpresa,
        ip,
        userAgent: userAgent ? userAgent.slice(0, 500) : null,
      },
    });

    const token = crypto.randomBytes(32).toString('hex');
    await prisma.demoToken.create({
      data: {
        token,
        leadId: lead.id,
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });

    await prisma.auditEntry
      .create({
        data: {
          actorId: null,
          actorEmail: email,
          action: 'request_demo',
          entity: 'demo_lead',
          entityId: lead.id,
          details: JSON.stringify({ nome, empresa }),
          ip,
          userAgent: userAgent ? userAgent.slice(0, 500) : null,
        },
      })
      .catch(() => {});

    const demoBase =
      (process.env.DEMO_REDIRECT_URL || 'https://demo.godmanager.us').replace(/\/+$/, '');
    const redirectTo = `${demoBase}/auth-by-token?t=${encodeURIComponent(token)}`;

    return NextResponse.json({ ok: true, redirectTo });
  } catch (e) {
    console.error('[POST /api/request-demo]', e);
    return NextResponse.json({ ok: false, code: 'INTERNAL' }, { status: 500 });
  }
}
