import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { requireSuperAdmin } from '@/lib/requireSuperAdmin';
import { recordAudit } from '@/lib/auditServer';
import {
  isActiveNonSuperAdminWithoutClient,
  prismaRoleStatusClient,
  snapshotFromUpdate,
  USER_INTEGRITY_SELECT_COMPANY,
  UserIntegrityError,
} from '@/lib/userIntegrity';
import type { UserRole, UserStatus } from '@prisma/client';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const gate = await requireSuperAdmin();
  if (gate.error) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  const u = await prisma.user.findUnique({ where: { id: params.id } });
  if (!u) return NextResponse.json({ ok: false, error: 'Nao encontrado.' }, { status: 404 });
  return NextResponse.json({
    ok: true,
    user: {
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
    },
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireSuperAdmin();
  if (gate.error) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

  try {
    const existing = await prisma.user.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Nao encontrado.' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    const changedFields: string[] = [];
    let passwordChanged = false;

    if (typeof body.firstName === 'string') {
      const v = body.firstName.trim();
      data.firstName = v;
      if (v !== existing.firstName) changedFields.push('firstName');
    }
    if (typeof body.lastName === 'string') {
      const v = body.lastName.trim();
      data.lastName = v;
      if (v !== existing.lastName) changedFields.push('lastName');
    }
    if (typeof body.email === 'string') {
      const v = body.email.trim().toLowerCase();
      data.email = v;
      if (v !== existing.email) changedFields.push('email');
    }
    if (typeof body.phone === 'string' || body.phone === null) {
      data.phone = body.phone;
      if (body.phone !== existing.phone) changedFields.push('phone');
    }
    if (typeof body.role === 'string') {
      const v = body.role as UserRole;
      data.role = v;
      if (v !== existing.role) changedFields.push(`role:${existing.role}->${v}`);
    }
    if (typeof body.status === 'string') {
      const v = body.status as UserStatus;
      data.status = v;
      if (v !== existing.status) changedFields.push(`status:${existing.status}->${v}`);
    }
    if (Array.isArray(body.permissions)) {
      const v = body.permissions.map(String);
      data.permissions = v;
      if (JSON.stringify(v) !== JSON.stringify(existing.permissions)) {
        changedFields.push('permissions');
      }
    }
    if (typeof body.password === 'string' && body.password.length > 0) {
      if (body.password.length < 8) {
        return NextResponse.json({ ok: false, error: 'Password min 8 chars.' }, { status: 400 });
      }
      data.passwordHash = await hashPassword(body.password);
      passwordChanged = true;
    }
    if (typeof body.lastActive === 'string' && body.lastActive.length > 0) {
      const v = new Date(body.lastActive);
      data.lastActive = v;
      if (v.getTime() !== existing.lastActive.getTime()) changedFields.push('lastActive');
    }
    if (typeof body.clientId === 'string') {
      const v = body.clientId.replace(/\0/g, '').trim();
      if (!v) {
        return NextResponse.json({ ok: false, error: USER_INTEGRITY_SELECT_COMPANY }, { status: 400 });
      }
      const client = await prisma.client.findUnique({ where: { id: v }, select: { id: true } });
      if (!client) {
        return NextResponse.json({ ok: false, error: 'Cliente nao encontrado.' }, { status: 404 });
      }
      data.clientId = v;
      if (v !== existing.clientId) changedFields.push(`clientId:${existing.clientId ?? 'null'}->${v}`);
    } else if (body.clientId === null) {
      data.clientId = null;
      if (existing.clientId !== null) changedFields.push('clientId:cleared');
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: 'Nenhum campo para atualizar.' }, { status: 400 });
    }

    if (changedFields.length === 0 && !passwordChanged) {
      return NextResponse.json({ ok: false, error: 'Nenhuma alteracao efectiva.' }, { status: 400 });
    }

    const resulting = snapshotFromUpdate(
      prismaRoleStatusClient(existing.role, existing.status, existing.clientId),
      data,
    );
    if (isActiveNonSuperAdminWithoutClient(resulting.role, resulting.status, resulting.clientId)) {
      return NextResponse.json({ ok: false, error: USER_INTEGRITY_SELECT_COMPANY }, { status: 400 });
    }

    const user = await prisma.user.update({ where: { id: params.id }, data: data as import('@prisma/client').Prisma.UserUpdateInput });

    if (changedFields.length > 0) {
      await recordAudit({
        request: req,
        actor: { id: gate.user!.id, email: gate.user!.email },
        action: 'user.update',
        entity: 'user',
        entityId: params.id,
        targetUserId: params.id,
        details: `changed: ${changedFields.join(', ')}`,
        clientId: existing.clientId,
      });
    }
    if (passwordChanged) {
      await recordAudit({
        request: req,
        actor: { id: gate.user!.id, email: gate.user!.email },
        action: 'user.password_change',
        entity: 'user',
        entityId: params.id,
        targetUserId: params.id,
        details: 'password changed by super_admin',
        clientId: existing.clientId,
      });
    }

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
      },
    });
  } catch (e: unknown) {
    if (e instanceof UserIntegrityError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
    }
    const err = e as { code?: string };
    if (err?.code === 'P2025') return NextResponse.json({ ok: false, error: 'Nao encontrado.' }, { status: 404 });
    console.error('[api/admin/users/[id] PATCH]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireSuperAdmin();
  if (gate.error) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  const actor = gate.user;
  if (!actor) return NextResponse.json({ ok: false, error: 'Nao autenticado' }, { status: 401 });
  try {
    if (actor.id === params.id) {
      return NextResponse.json({ ok: false, error: 'Nao podes eliminar a tua propria conta.' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, email: true, role: true, clientId: true },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Nao encontrado.' }, { status: 404 });
    }

    await recordAudit({
      request: req,
      actor: { id: actor.id, email: actor.email },
      action: 'user.delete',
      entity: 'user',
      entityId: params.id,
      targetUserId: params.id,
      details: `email: ${existing.email} | role: ${existing.role}`,
      clientId: existing.clientId,
    });

    await prisma.user.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2025') return NextResponse.json({ ok: false, error: 'Nao encontrado.' }, { status: 404 });
    console.error('[api/admin/users/[id] DELETE]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}
