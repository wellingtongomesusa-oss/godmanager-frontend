import type { User } from '@prisma/client';
import type { UserRole } from '@/lib/types';

export interface ClientScopeUser {
  id: string;
  role: UserRole;
  clientId: string | null;
}

/**
 * Returns a Prisma 'where' fragment that scopes queries to the
 * current user's Client (tenant). Super-admins receive an empty
 * filter and see everything across all clients. Users without a
 * clientId see nothing.
 *
 * Usage:
 *   const scope = getClientScopeWhere(user);
 *   const properties = await prisma.property.findMany({
 *     where: { ...scope, ...otherFilters },
 *   });
 */
export function getClientScopeWhere(user: ClientScopeUser): { clientId?: string } | { id: string } {
  if (user.role === 'super_admin') return {};
  if (!user.clientId) return { id: '__no_access__' };
  return { clientId: user.clientId };
}

/**
 * Returns clientId to attach to a new row being created. Super-admins
 * must explicitly choose a clientId (returns null = let caller decide).
 * Other users always create rows under their own clientId.
 */
export function getClientScopeForCreate(user: ClientScopeUser): string | null {
  if (user.role === 'super_admin') return null;
  return user.clientId;
}

/**
 * Returns true if the user is allowed to access a resource with the
 * given clientId. Super-admins can access anything. Others only their
 * own clientId.
 */
export function canAccessClientId(user: ClientScopeUser, resourceClientId: string | null): boolean {
  if (user.role === 'super_admin') return true;
  if (!user.clientId) return false;
  if (!resourceClientId) return false;
  return user.clientId === resourceClientId;
}

export function toClientScopeUser(user: Pick<User, 'id' | 'role' | 'clientId'>): ClientScopeUser {
  return {
    id: user.id,
    role: user.role as UserRole,
    clientId: user.clientId,
  };
}
