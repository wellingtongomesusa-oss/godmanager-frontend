import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const firstName = String(body?.firstName || '').trim();
    const lastName = String(body?.lastName || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');

    if (!firstName || !lastName || !email) {
      return NextResponse.json({ ok: false, error: 'firstName, lastName e email sao obrigatorios.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ ok: false, error: 'Password com pelo menos 8 caracteres.' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ ok: false, error: 'Email ja existe.' }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        role: 'viewer',
        status: 'pending',
        permissions: [],
        passwordHash: hashPassword(password),
      },
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        lastActive: user.lastActive,
        permissions: user.permissions,
      },
    });
  } catch (e) {
    console.error('[api/auth/register]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}
