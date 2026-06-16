import { NextResponse } from 'next/server';
import type { UserStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveClientUsersScope } from '@/lib/clientUsersScope';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

const VALID_STATUSES: UserStatus[] = ['active', 'suspended', 'pending'];

const MENU_ACCESS_ADMIN_ROLES = new Set(['admin', 'super_admin']);

/**
 * menuAccess semantics (F1.B will enforce in UI/API reads):
 * - Empty array = no restriction (current role-based behavior).
 * - super_admin always has full access; menuAccess never restricts super_admin.
 */
function parseMenuAccessInput(raw: unknown): { ok: true; value: string[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) {
    return { ok: false, error: 'menuAccess deve ser um array.' };
  }
  for (const item of raw) {
    if (typeof item !== 'string') {
      return { ok: false, error: 'menuAccess deve conter apenas strings.' };
    }
  }
  return { ok: true, value: raw.map((s) => s.trim()) };
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const actor = await getCurrentUserFromSession();
  if (!actor) {
    return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const scope = await resolveClientUsersScope(actor, body?.clientId);
    if (!scope.ok) {
      return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
    }

    const target = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        clientId: true,
        role: true,
        email: true,
        status: true,
        menuAccess: true,
      },
    });
    if (!target || target.clientId !== scope.clientId) {
      return NextResponse.json({ ok: false, error: 'Utilizador não encontrado.' }, { status: 404 });
    }
    if (target.role === 'super_admin') {
      return NextResponse.json({ ok: false, error: 'Operação não permitida.' }, { status: 403 });
    }

    const data: { status?: UserStatus; menuAccess?: string[] } = {};
    const changedFields: string[] = [];

    if (typeof body.status === 'string') {
      const st = body.status as UserStatus;
      if (!VALID_STATUSES.includes(st)) {
        return NextResponse.json({ ok: false, error: 'Status inválido.' }, { status: 400 });
      }
      data.status = st;
      if (st !== target.status) changedFields.push(`status:${target.status}->${st}`);
    }

    if (body.menuAccess !== undefined) {
      const actorRole = String(actor.role || '').toLowerCase();
      if (!MENU_ACCESS_ADMIN_ROLES.has(actorRole)) {
        return NextResponse.json(
          { ok: false, error: 'Apenas administradores podem editar menuAccess.' },
          { status: 403 },
        );
      }
      const parsed = parseMenuAccessInput(body.menuAccess);
      if (!parsed.ok) {
        return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
      }
      data.menuAccess = parsed.value;
      if (JSON.stringify(parsed.value) !== JSON.stringify(target.menuAccess)) {
        changedFields.push('menuAccess');
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: 'Nenhum campo para atualizar.' }, { status: 400 });
    }

    if (changedFields.length === 0) {
      return NextResponse.json({ ok: false, error: 'Nenhuma alteração efectiva.' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        menuAccess: true,
        createdAt: true,
        lastActive: true,
      },
    });

    await recordAudit({
      request: req,
      actor: { id: actor.id, email: actor.email },
      action: 'user.update',
      entity: 'user',
      entityId: params.id,
      targetUserId: params.id,
      details: `changed: ${changedFields.join(', ')}`,
      clientId: scope.clientId,
    });

    return NextResponse.json({
      ok: true,
      user: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        lastActive: updated.lastActive.toISOString(),
      },
    });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2025') {
      return NextResponse.json({ ok: false, error: 'Utilizador não encontrado.' }, { status: 404 });
    }
    console.error('[api/client/users/[id] PATCH]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const actor = await getCurrentUserFromSession();
  if (!actor) {
    return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  }

  const url = new URL(req.url);
  const scope = await resolveClientUsersScope(actor, url.searchParams.get('clientId'));
  if (!scope.ok) {
    return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
  }

  if (actor.id === params.id) {
    return NextResponse.json(
      { ok: false, error: 'Não pode eliminar a sua própria conta.' },
      { status: 400 },
    );
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, clientId: true, role: true, email: true },
    });
    if (!target || target.clientId !== scope.clientId) {
      return NextResponse.json({ ok: false, error: 'Utilizador não encontrado.' }, { status: 404 });
    }
    if (target.role === 'super_admin') {
      return NextResponse.json({ ok: false, error: 'Operação não permitida.' }, { status: 403 });
    }

    await recordAudit({
      request: req,
      actor: { id: actor.id, email: actor.email },
      action: 'user.delete',
      entity: 'user',
      entityId: params.id,
      targetUserId: params.id,
      details: `email: ${target.email} | role: ${target.role}`,
      clientId: scope.clientId,
    });

    await prisma.user.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2025') {
      return NextResponse.json({ ok: false, error: 'Utilizador não encontrado.' }, { status: 404 });
    }
    console.error('[api/client/users/[id] DELETE]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}
