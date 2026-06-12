import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { requireSuperAdmin } from '@/lib/requireSuperAdmin';
import { recordAudit } from '@/lib/auditServer';

function generateRandomPassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*';
  const all = upper + lower + digits + symbols;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  let pwd = pick(upper) + pick(lower) + pick(digits) + pick(symbols);
  for (let i = 4; i < length; i++) pwd += pick(all);
  return pwd
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

export async function GET() {
  const gate = await requireSuperAdmin();
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
  const gate = await requireSuperAdmin();
  if (gate.error) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    const rawPassword = String(body?.password ?? '').trim();
    const firstName = String(body?.firstName || '').trim();
    const lastName = String(body?.lastName || '').trim();
    const phone = body?.phone ? String(body.phone).trim() : null;
    const role = String(body?.role || 'viewer');
    const status = String(body?.status || 'active');
    const permissions = Array.isArray(body?.permissions) ? body.permissions.map(String) : [];

    if (!email || !firstName || !lastName) {
      return NextResponse.json({ ok: false, error: 'email, firstName, lastName sao obrigatorios.' }, { status: 400 });
    }

    let password: string;
    if (rawPassword.length > 0) {
      if (rawPassword.length < 8) {
        return NextResponse.json({ ok: false, error: 'Password com pelo menos 8 caracteres.' }, { status: 400 });
      }
      password = rawPassword;
    } else {
      password = generateRandomPassword(12);
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ ok: false, error: 'Email ja existe.' }, { status: 409 });
    }

    const validRoles = ['super_admin', 'admin', 'manager', 'accountant', 'leasing', 'maintenance', 'viewer', 'supervisor', 'supervisor_2', 'vendor'];
    const validStatuses = ['active', 'suspended', 'pending'];
    if (!validRoles.includes(role)) return NextResponse.json({ ok: false, error: 'Role invalido.' }, { status: 400 });
    if (!validStatuses.includes(status)) return NextResponse.json({ ok: false, error: 'Status invalido.' }, { status: 400 });

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        role: role as import('@prisma/client').UserRole,
        status: status as import('@prisma/client').UserStatus,
        permissions,
        passwordHash,
      },
    });

    await recordAudit({
      request: req,
      actor: { id: gate.user!.id, email: gate.user!.email },
      action: 'user.create',
      entity: 'user',
      entityId: user.id,
      targetUserId: user.id,
      details: `email: ${user.email} | role: ${user.role}`,
      clientId: user.clientId,
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
