import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { createSessionCookie } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

const DEMO_USER_EMAIL = 'demo@godmanager.us';

/**
 * Demo-side endpoint. Recebe um token gerado pelo SITE REAL,
 * valida-o contra `${REAL_SITE_URL}/api/validate-demo-token` e,
 * em caso afirmativo, cria sessão local para o utilizador `demo@godmanager.us`.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token ?? '').trim();
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Token em falta.' }, { status: 400 });
    }

    const realBase = (process.env.REAL_SITE_URL || '').replace(/\/+$/, '');
    if (!realBase) {
      return NextResponse.json(
        { ok: false, error: 'REAL_SITE_URL nao configurado.' },
        { status: 500 },
      );
    }

    const validateRes = await fetch(`${realBase}/api/validate-demo-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      cache: 'no-store',
    }).catch((e) => {
      console.error('[auth-by-token] fetch real site failed', e);
      return null;
    });

    if (!validateRes) {
      return NextResponse.json(
        { ok: false, error: 'Falha ao contactar site principal.' },
        { status: 502 },
      );
    }
    const data = await validateRes.json().catch(() => ({}));
    if (!validateRes.ok || !data?.ok) {
      return NextResponse.json(
        { ok: false, error: data?.error || 'Token invalido.' },
        { status: validateRes.status || 401 },
      );
    }

    const demoUser = await prisma.user.findUnique({ where: { email: DEMO_USER_EMAIL } });
    if (!demoUser) {
      return NextResponse.json(
        { ok: false, error: 'Utilizador demo nao existe neste ambiente.' },
        { status: 500 },
      );
    }

    const role = (demoUser.role || 'admin') as 'admin' | 'manager' | 'viewer';
    const cookie = createSessionCookie(demoUser.id, role);
    cookies().set(cookie);

    await prisma.auditEntry
      .create({
        data: {
          actorId: demoUser.id,
          actorEmail: demoUser.email,
          action: 'demo_login',
          entity: 'user',
          entityId: demoUser.id,
          details: JSON.stringify({
            leadEmail: data.leadEmail,
            leadCompany: data.leadCompany,
            leadName: data.leadName,
          }),
        },
      })
      .catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[POST /api/auth-by-token]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}
