import { NextResponse } from 'next/server';
import type { UserRole, UserStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { hashPassword } from '@/lib/password';
import { getMaxUsersForClientPlan, clientPlanLabelPt } from '@/lib/clientPlanLimits';
import { resolveClientUsersScope } from '@/lib/clientUsersScope';
import { assertVendorBelongsToClient } from '@/lib/fieldVendorScope';

export const dynamic = 'force-dynamic';

const ALLOWED_CREATE_ROLES: UserRole[] = ['admin', 'manager', 'maintenance', 'field'];

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

function mapUser(u: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  vendorId?: string | null;
  createdAt: Date;
  lastActive: Date;
}) {
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    phone: u.phone,
    role: u.role,
    status: u.status,
    vendorId: u.vendorId ?? null,
    createdAt: u.createdAt.toISOString(),
    lastActive: u.lastActive.toISOString(),
  };
}

async function loadClientMeta(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      companyName: true,
      plan: true,
      users: { where: { status: 'active' }, select: { id: true } },
    },
  });
  if (!client) return null;
  const maxUsers = getMaxUsersForClientPlan(client.plan);
  return {
    clientId: client.id,
    companyName: client.companyName,
    plan: client.plan,
    planLabel: clientPlanLabelPt(client.plan),
    activeUserCount: client.users.length,
    maxUsers,
  };
}

export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  }

  const url = new URL(req.url);
  const scope = await resolveClientUsersScope(user, url.searchParams.get('clientId'));
  if (!scope.ok) {
    return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
  }

  try {
    const meta = await loadClientMeta(scope.clientId);
    if (!meta) {
      return NextResponse.json({ ok: false, error: 'Cliente não encontrado.' }, { status: 404 });
    }

    const users = await prisma.user.findMany({
      where: { clientId: scope.clientId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        vendorId: true,
        createdAt: true,
        lastActive: true,
      },
    });

    return NextResponse.json({
      ok: true,
      users: users.map(mapUser),
      meta,
    });
  } catch (e) {
    console.error('[api/client/users GET]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const scope = await resolveClientUsersScope(user, body?.clientId);
    if (!scope.ok) {
      return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
    }

    const role = String(body?.role || '').trim().toLowerCase();
    if (role === 'super_admin') {
      return NextResponse.json(
        { ok: false, error: 'Não é permitido criar utilizador super_admin.' },
        { status: 403 },
      );
    }
    if (!ALLOWED_CREATE_ROLES.includes(role as UserRole)) {
      return NextResponse.json(
        { ok: false, error: 'Role inválido. Permitidos: admin, manager, maintenance, field.' },
        { status: 400 },
      );
    }

    const vendorIdRaw = String(body?.vendorId ?? '').trim();
    let vendorId: string | null = null;
    if (role === 'field') {
      if (!vendorIdRaw) {
        return NextResponse.json(
          { ok: false, error: 'vendorId é obrigatório para utilizadores de campo (field).' },
          { status: 400 },
        );
      }
      const vendorCheck = await assertVendorBelongsToClient(vendorIdRaw, scope.clientId);
      if (!vendorCheck.ok) {
        return NextResponse.json({ ok: false, error: vendorCheck.error }, { status: vendorCheck.status });
      }
      vendorId = vendorIdRaw;
    } else if (vendorIdRaw) {
      const vendorCheck = await assertVendorBelongsToClient(vendorIdRaw, scope.clientId);
      if (!vendorCheck.ok) {
        return NextResponse.json({ ok: false, error: vendorCheck.error }, { status: vendorCheck.status });
      }
    }

    const firstName = String(body?.firstName || '').trim();
    const lastName = String(body?.lastName || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const rawPassword = String(body?.password ?? '').trim();

    if (!email || !firstName || !lastName) {
      return NextResponse.json(
        { ok: false, error: 'firstName, lastName e email são obrigatórios.' },
        { status: 400 },
      );
    }

    let password: string;
    if (rawPassword.length > 0) {
      if (rawPassword.length < 8) {
        return NextResponse.json(
          { ok: false, error: 'Senha com pelo menos 8 caracteres.' },
          { status: 400 },
        );
      }
      password = rawPassword;
    } else {
      password = generateRandomPassword(12);
    }

    const client = await prisma.client.findUnique({
      where: { id: scope.clientId },
      select: {
        id: true,
        plan: true,
        users: { where: { status: 'active' }, select: { id: true } },
      },
    });
    if (!client) {
      return NextResponse.json({ ok: false, error: 'Cliente não encontrado.' }, { status: 404 });
    }

    const maxUsers = getMaxUsersForClientPlan(client.plan);
    if (client.users.length >= maxUsers) {
      return NextResponse.json(
        {
          ok: false,
          error: `Limite de usuários do plano atingido (${client.users.length}/${maxUsers}).`,
          maxUsers,
          activeUserCount: client.users.length,
        },
        { status: 409 },
      );
    }

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ ok: false, error: 'Email já existe.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const created = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        role: role as UserRole,
        status: 'active',
        permissions: [],
        passwordHash,
        clientId: scope.clientId,
        vendorId: role === 'field' ? vendorId : null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        vendorId: true,
        createdAt: true,
        lastActive: true,
      },
    });

    const meta = await loadClientMeta(scope.clientId);

    return NextResponse.json({
      ok: true,
      user: mapUser(created),
      passwordPlain: password,
      meta,
    });
  } catch (e) {
    console.error('[api/client/users POST]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}
