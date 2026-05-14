import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import { createSessionCookie } from '@/lib/authServer';
import type { UserRole } from '@/lib/types';

function isDatabaseUnreachable(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    return ['P1001', 'P1017'].includes(e.code);
  }
  if (e instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }
  const msg = e instanceof Error ? e.message : String(e);
  return /Can't reach database|ECONNREFUSED|connection refused|Server has closed the connection/i.test(msg);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const emailRaw = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');

    if (!emailRaw || !password) {
      return NextResponse.json({ ok: false, error: 'Email e password sao obrigatorios.' }, { status: 400 });
    }

    let user = await prisma.user.findUnique({ where: { email: emailRaw } });
    if (!user) {
      const users = await prisma.user.findMany({});
      user = users.find((u) => u.email.toLowerCase().split('@')[0] === emailRaw) || null;
    }

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Email ou password invalidos.' }, { status: 401 });
    }

    if (user.status === 'suspended') {
      return NextResponse.json({ ok: false, error: 'Conta suspensa. Contacta o administrador.' }, { status: 403 });
    }
    if (user.status === 'pending') {
      return NextResponse.json({ ok: false, error: 'Conta pendente de aprovacao.' }, { status: 403 });
    }

    const valid = verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ ok: false, error: 'Email ou password invalidos.' }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastActive: new Date() },
    });

    const cookie = createSessionCookie(user.id, user.role as UserRole);
    const res = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: user.status,
        permissions: user.permissions,
      },
    });
    res.cookies.set(cookie.name, cookie.value, {
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      path: cookie.path,
      maxAge: cookie.maxAge,
    });
    return res;
  } catch (e) {
    console.error('[api/auth/login]', e);
    if (isDatabaseUnreachable(e)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Base de dados indisponivel. Confirma que o Postgres esta a correr e que DATABASE_URL no .env.local esta correcto (ex.: docker compose up -d na raiz do GodManager).',
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}
