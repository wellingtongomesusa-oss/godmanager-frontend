import { prisma } from '@/lib/db';
import type { BankAccountType } from '@prisma/client';

type MinimalUser = {
  id: string;
  role: string | null;
  clientId?: string | null;
};

export type BankBalanceScopeOk = { ok: true; clientId: string };
export type BankBalanceScopeErr = { ok: false; status: number; error: string };
export type BankBalanceScope = BankBalanceScopeOk | BankBalanceScopeErr;

const MANAGE_ROLES = new Set(['admin', 'manager', 'super_admin']);

export function canManageBankBalances(role: string | null | undefined): boolean {
  return MANAGE_ROLES.has(String(role || '').toLowerCase());
}

/**
 * Escopo multi-tenant para saldos bancarios.
 * admin/manager: sempre user.clientId (ignora clientId do pedido se diferente).
 * super_admin: exige clientId explícito (cliente ativo) ou user.clientId na sessão.
 */
export async function resolveBankAccountClientScope(
  user: MinimalUser,
  incomingClientId: string | null | undefined,
): Promise<BankBalanceScope> {
  const role = String(user.role || '').toLowerCase();
  if (!canManageBankBalances(role)) {
    return { ok: false, status: 403, error: 'Acesso restrito a admin, manager ou super_admin.' };
  }

  const inc =
    incomingClientId == null ? '' : String(incomingClientId).replace(/\0/g, '').trim();

  if (role === 'admin' || role === 'manager') {
    const cid = (user.clientId || '').trim();
    if (!cid) {
      return { ok: false, status: 400, error: 'Cliente não definido para este utilizador.' };
    }
    if (inc && inc !== cid) {
      return { ok: false, status: 403, error: 'Não pode aceder a saldos de outro cliente.' };
    }
    return { ok: true, clientId: cid };
  }

  const cid = inc || (user.clientId || '').trim();
  if (!cid) {
    return {
      ok: false,
      status: 400,
      error: 'Envie clientId (cliente ativo) ou inicie sessão com tenant definido.',
    };
  }

  const c = await prisma.client.findUnique({
    where: { id: cid },
    select: { id: true },
  });
  if (!c) {
    return { ok: false, status: 404, error: 'Cliente não encontrado.' };
  }
  return { ok: true, clientId: cid };
}

export const BANK_ACCOUNT_TYPES: BankAccountType[] = [
  'TRUST_CHASE',
  'OPERATING_TRUST',
  'DEPOSIT_SECURITY',
];

export function isValidBankAccountType(v: string): v is BankAccountType {
  return (BANK_ACCOUNT_TYPES as string[]).includes(v);
}
