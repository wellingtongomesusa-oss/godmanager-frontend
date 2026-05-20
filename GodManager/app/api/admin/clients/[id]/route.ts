import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

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
