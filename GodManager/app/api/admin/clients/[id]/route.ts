import { NextResponse } from 'next/server';
import type { ClientPlan } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

const PLANS = ['starter', 'professional', 'enterprise'] as const;

async function requireSuperAdmin(): Promise<
  | { ok: false; status: number; body: { ok: false; error: string } }
  | { ok: true }
> {
  const user = await getCurrentUserFromSession();
  if (!user) return { ok: false, status: 401, body: { ok: false, error: 'Nao autenticado.' } };
  if (user.role !== 'super_admin')
    return { ok: false, status: 403, body: { ok: false, error: 'Acesso negado.' } };
  return { ok: true };
}

/** Remove Client e todos os Users com clientId — apenas super_admin. Falha se existirem FKs órfãs (dados ligados ao client). */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });

  const id = String(params?.id || '').trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: 'ID invalido.' }, { status: 400 });
  }

  try {
    const existing = await prisma.client.findUnique({
      where: { id },
      select: { id: true, companyName: true, _count: { select: { users: true } } },
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Cliente nao encontrado.' }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const deletedUsers = await tx.user.deleteMany({ where: { clientId: id } });
      await tx.client.delete({ where: { id } });
      return { deletedUsersCount: deletedUsers.count, companyName: existing.companyName };
    });

    return NextResponse.json({
      ok: true,
      deletedClient: result.companyName,
      deletedUsers: result.deletedUsersCount,
    });
  } catch (e) {
    console.error('[api/admin/clients DELETE]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/clients/[id]  { active?, plan?, maxUsers? } — super_admin.
 * Bloqueia/ativa o tenant (active) e/ou muda plano/limite de usuários. Um tenant inativo não
 * consegue logar (enforcement no login). Aditivo, com auditoria.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Nao autenticado.' }, { status: 401 });
  if (user.role !== 'super_admin') return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });

  const id = String(params?.id || '').trim();
  if (!id) return NextResponse.json({ ok: false, error: 'ID invalido.' }, { status: 400 });

  try {
    const body = (await req.json().catch(() => ({}))) as { active?: unknown; plan?: unknown; maxUsers?: unknown };
    const existing = await prisma.client.findUnique({ where: { id }, select: { id: true, companyName: true, active: true, plan: true, maxUsers: true } });
    if (!existing) return NextResponse.json({ ok: false, error: 'Cliente nao encontrado.' }, { status: 404 });

    const data: { active?: boolean; plan?: ClientPlan; maxUsers?: number | null } = {};
    const changes: string[] = [];
    if (typeof body.active === 'boolean' && body.active !== existing.active) {
      data.active = body.active;
      changes.push(body.active ? 'ativado' : 'bloqueado');
    }
    if (typeof body.plan === 'string' && (PLANS as readonly string[]).includes(body.plan)) {
      if (body.plan !== existing.plan) { data.plan = body.plan as ClientPlan; changes.push(`plano:${existing.plan}->${body.plan}`); }
    }
    if (body.maxUsers !== undefined) {
      const mu = body.maxUsers === null || body.maxUsers === '' ? null : Number(body.maxUsers);
      if (mu !== null && (!Number.isFinite(mu) || mu < 0 || mu > 10000)) {
        return NextResponse.json({ ok: false, error: 'maxUsers invalido (0-10000).' }, { status: 400 });
      }
      if (mu !== existing.maxUsers) { data.maxUsers = mu; changes.push(`maxUsers:${existing.maxUsers ?? '-'}->${mu ?? '-'}`); }
    }

    if (!Object.keys(data).length) return NextResponse.json({ ok: false, error: 'Nada para atualizar.' }, { status: 400 });

    const updated = await prisma.client.update({
      where: { id },
      data,
      select: { id: true, companyName: true, active: true, plan: true, maxUsers: true },
    });

    await recordAudit({
      request: req, actor: { id: user.id, email: user.email },
      action: 'client.update', entity: 'client', entityId: id, clientId: id,
      details: `${existing.companyName}: ${changes.join(', ')}`,
    });

    return NextResponse.json({ ok: true, client: updated, changes });
  } catch (e) {
    console.error('[api/admin/clients PATCH]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}
