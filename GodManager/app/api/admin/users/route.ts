import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { hashPassword } from '@/lib/password';

type SessionUser = NonNullable<Awaited<ReturnType<typeof getCurrentUserFromSession>>>;

async function requireAdmin(): Promise<{ error: string; status: number; user: null } | { error: null; status: number; user: SessionUser }> {
  const user = await getCurrentUserFromSession();
  if (!user) return { error: 'Nao autenticado', status: 401, user: null };
  if (user.role !== 'admin') return { error: 'Apenas administradores', status: 403, user: null };
  return { error: null, status: 200, user };
}

export async function GET() {
  const gate = await requireAdmin();
  if (gate.error) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({
    ok: true,
    users: users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: u.phone,
      role: u.role,
      status: u.status,
      permissions: u.permissions,
      lastActive: u.lastActive,
      createdAt: u.createdAt,
    })),
  });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate.error) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const firstName = String(body?.firstName || '').trim();
    const lastName = String(body?.lastName || '').trim();
    const phone = body?.phone ? String(body.phone).trim() : null;
    const role = String(body?.role || 'viewer');
    const status = String(body?.status || 'active');
    const permissions = Array.isArray(body?.permissions) ? body.permissions.map(String) : [];

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json({ ok: false, error: 'email, password, firstName, lastName sao obrigatorios.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ ok: false, error: 'Password com pelo menos 8 caracteres.' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ ok: false, error: 'Email ja existe.' }, { status: 409 });
    }

    const validRoles = ['admin', 'manager', 'accountant', 'leasing', 'maintenance', 'viewer'];
    const validStatuses = ['active', 'suspended', 'pending'];
    if (!validRoles.includes(role)) return NextResponse.json({ ok: false, error: 'Role invalido.' }, { status: 400 });
    if (!validStatuses.includes(status)) return NextResponse.json({ ok: false, error: 'Status invalido.' }, { status: 400 });

    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        role: role as import('@prisma/client').UserRole,
        status: status as import('@prisma/client').UserStatus,
        permissions,
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
        phone: user.phone,
        role: user.role,
        status: user.status,
        permissions: user.permissions,
        createdAt: user.createdAt,
      },
    });
  } catch (e) {
    console.error('[api/admin/users POST]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}
