import type { Prisma, User } from '@prisma/client';
import { canAccessClientId, getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';

/** Utilizador com escopo de listagem/edição de jobs (pm_expenses). */
export type PmExpenseScopeUser = Pick<User, 'id' | 'role' | 'clientId' | 'vendorId'>;

const NO_ACCESS: Prisma.PmExpenseWhereInput = { id: '__no_access__' };

/**
 * Filtro de listagem: tenant (clientId) +, para role field, vendorId do utilizador.
 * field sem vendorId → lista vazia (não vaza dados).
 */
export function getPmExpensesListWhere(user: PmExpenseScopeUser): Prisma.PmExpenseWhereInput {
  if (user.role === 'field') {
    const cid = (user.clientId || '').trim();
    const vid = (user.vendorId || '').trim();
    if (!cid || !vid) return NO_ACCESS;
    return { clientId: cid, vendorId: vid };
  }

  return getClientScopeWhere(toClientScopeUser(user)) as Prisma.PmExpenseWhereInput;
}

/** Acesso a um job individual (leitura/alteração). */
export function canAccessPmExpense(
  user: PmExpenseScopeUser,
  expense: { clientId: string | null; vendorId: string | null },
): boolean {
  if (user.role === 'field') {
    const cid = (user.clientId || '').trim();
    const vid = (user.vendorId || '').trim();
    if (!cid || !vid) return false;
    if ((expense.clientId || '').trim() !== cid) return false;
    if ((expense.vendorId || '').trim() !== vid) return false;
    return true;
  }

  return canAccessClientId(toClientScopeUser(user), expense.clientId);
}

export function isFieldRole(user: Pick<User, 'role'>): boolean {
  return user.role === 'field';
}
