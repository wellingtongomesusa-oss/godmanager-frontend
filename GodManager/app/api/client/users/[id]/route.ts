import { NextResponse } from 'next/server';
import type { UserStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveClientUsersScope } from '@/lib/clientUsersScope';

export const dynamic = 'force-dynamic';

const VALID_STATUSES: UserStatus[] = ['active', 'suspended', 'pending'];

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
      select: { id: true, clientId: true, role: true },
    });
    if (!target || target.clientId !== scope.clientId) {
      return NextResponse.json({ ok: false, error: 'Utilizador não encontrado.' }, { status: 404 });
    }
    if (target.role === 'super_admin') {
      return NextResponse.json({ ok: false, error: 'Operação não permitida.' }, { status: 403 });
    }

    const data: { status?: UserStatus } = {};
    if (typeof body.status === 'string') {
      const st = body.status as UserStatus;
      if (!VALID_STATUSES.includes(st)) {
        return NextResponse.json({ ok: false, error: 'Status inválido.' }, { status: 400 });
      }
      data.status = st;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: 'Nenhum campo para atualizar.' }, { status: 400 });
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
        createdAt: true,
        lastActive: true,
      },
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
      select: { id: true, clientId: true, role: true },
    });
    if (!target || target.clientId !== scope.clientId) {
      return NextResponse.json({ ok: false, error: 'Utilizador não encontrado.' }, { status: 404 });
    }
    if (target.role === 'super_admin') {
      return NextResponse.json({ ok: false, error: 'Operação não permitida.' }, { status: 403 });
    }

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
