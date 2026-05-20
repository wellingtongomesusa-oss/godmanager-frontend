import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { requireSuperAdmin } from '@/lib/requireSuperAdmin';

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
    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (typeof body.firstName === 'string') data.firstName = body.firstName.trim();
    if (typeof body.lastName === 'string') data.lastName = body.lastName.trim();
    if (typeof body.email === 'string') data.email = body.email.trim().toLowerCase();
    if (typeof body.phone === 'string' || body.phone === null) data.phone = body.phone;
    if (typeof body.role === 'string') data.role = body.role;
    if (typeof body.status === 'string') data.status = body.status;
    if (Array.isArray(body.permissions)) data.permissions = body.permissions.map(String);
    if (typeof body.password === 'string' && body.password.length > 0) {
      if (body.password.length < 8) {
        return NextResponse.json({ ok: false, error: 'Password min 8 chars.' }, { status: 400 });
      }
      data.passwordHash = await hashPassword(body.password);
    }
    if (typeof body.lastActive === 'string' && body.lastActive.length > 0) {
      data.lastActive = new Date(body.lastActive);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: 'Nenhum campo para atualizar.' }, { status: 400 });
    }

    const user = await prisma.user.update({ where: { id: params.id }, data: data as import('@prisma/client').Prisma.UserUpdateInput });
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
    const err = e as { code?: string };
    if (err?.code === 'P2025') return NextResponse.json({ ok: false, error: 'Nao encontrado.' }, { status: 404 });
    console.error('[api/admin/users/[id] PATCH]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const gate = await requireSuperAdmin();
  if (gate.error) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  const actor = gate.user;
  if (!actor) return NextResponse.json({ ok: false, error: 'Nao autenticado' }, { status: 401 });
  try {
    if (actor.id === params.id) {
      return NextResponse.json({ ok: false, error: 'Nao podes eliminar a tua propria conta.' }, { status: 400 });
    }
    await prisma.user.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2025') return NextResponse.json({ ok: false, error: 'Nao encontrado.' }, { status: 404 });
    console.error('[api/admin/users/[id] DELETE]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}
