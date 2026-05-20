import { prisma } from '@/lib/db';

type MinimalUser = {
  role: string | null;
  clientId?: string | null;
};

export type ClientUsersScopeOk = { ok: true; clientId: string };
export type ClientUsersScopeErr = { ok: false; status: number; error: string };
export type ClientUsersScope = ClientUsersScopeOk | ClientUsersScopeErr;

/**
 * Escopo para gestão de utilizadores do tenant.
 * admin: sempre user.clientId (ignora clientId do pedido se diferente).
 * super_admin: exige clientId explícito (cliente ativo no Dashboard Admin).
 */
export async function resolveClientUsersScope(
  user: MinimalUser,
  incomingClientId: string | null | undefined,
): Promise<ClientUsersScope> {
  const role = String(user.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'super_admin') {
    return { ok: false, status: 403, error: 'Acesso restrito a administradores.' };
  }

  const inc =
    incomingClientId == null ? '' : String(incomingClientId).replace(/\0/g, '').trim();

  if (role === 'admin') {
    const cid = (user.clientId || '').trim();
    if (!cid) {
      return { ok: false, status: 400, error: 'Cliente não definido para este utilizador.' };
    }
    if (inc && inc !== cid) {
      return { ok: false, status: 403, error: 'Não pode gerir utilizadores de outro cliente.' };
    }
    return { ok: true, clientId: cid };
  }

  if (!inc) {
    return {
      ok: false,
      status: 400,
      error: 'Envie clientId (cliente selecionado no Dashboard Admin).',
    };
  }

  const c = await prisma.client.findUnique({
    where: { id: inc },
    select: { id: true },
  });
  if (!c) {
    return { ok: false, status: 404, error: 'Cliente não encontrado.' };
  }
  return { ok: true, clientId: inc };
}
