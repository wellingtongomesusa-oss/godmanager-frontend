import { prisma } from '@/lib/db';

type MinimalUser = {
  role: string | null;
  clientId?: string | null;
};

export type AuditGlSnapScopeOk = { ok: true; clientId: string };
export type AuditGlSnapScopeErr = { ok: false; status: number; error: string };
export type AuditGlSnapScope = AuditGlSnapScopeOk | AuditGlSnapScopeErr;

/**
 * Auditoria GL 2026 snapshots: mesmo clientId enviado na UI (`getActiveClient` para super_admin).
 */
export async function resolveAuditGlSnapshotClientScope(
  user: MinimalUser,
  incomingClientId: string | null | undefined,
): Promise<AuditGlSnapScope> {
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
      return { ok: false, status: 403, error: 'Escopo cliente inválido para este utilizador.' };
    }
    return { ok: true, clientId: cid };
  }

  const target = inc || (user.clientId || '').trim();
  if (!target) {
    return {
      ok: false,
      status: 400,
      error:
        'Selecione o modo cliente (super_admin) ou envie clientId conforme o cliente em contexto.',
    };
  }

  const c = await prisma.client.findUnique({
    where: { id: target },
    select: { id: true },
  });
  if (!c) {
    return { ok: false, status: 404, error: 'Cliente não encontrado.' };
  }
  return { ok: true, clientId: target };
}
