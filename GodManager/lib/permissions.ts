import { prisma } from '@/lib/db';

export type ResourceName =
  | 'owners'
  | 'properties'
  | 'tenants'
  | 'expenses'
  | 'payouts'
  | 'jobs'
  | 'maintenance'
  | 'audit';

export type ActionName = 'read' | 'write' | 'create' | 'delete' | '*';

export interface PermissionCheckUser {
  id: string;
  role: string;
  clientId: string | null;
}

/**
 * Check if a user has permission to perform an action on a resource.
 *
 * Bypass rules:
 *  - super_admin role: bypass all checks (returns true)
 *
 * Standard check:
 *  - Looks for a row in user_permissions where:
 *    userId = user.id
 *    AND clientId = user.clientId (or NULL)
 *    AND resource = requested resource
 *    AND action IN (requested action, '*')
 */
export async function hasPermission(
  user: PermissionCheckUser,
  resource: ResourceName,
  action: Exclude<ActionName, '*'>,
): Promise<boolean> {
  if (!user) return false;

  // Bypass for super_admin
  if (user.role === 'super_admin') return true;

  const perm = await prisma.userPermission.findFirst({
    where: {
      userId: user.id,
      clientId: user.clientId ?? null,
      resource,
      action: { in: [action, '*'] },
    },
    select: { id: true },
  });

  return Boolean(perm);
}

/**
 * Throw 403 helper for use inside API route handlers.
 */
export async function requirePermission(
  user: PermissionCheckUser,
  resource: ResourceName,
  action: Exclude<ActionName, '*'>,
): Promise<void> {
  const ok = await hasPermission(user, resource, action);
  if (!ok) {
    throw new Error(`forbidden: missing ${resource}:${action}`);
  }
}
