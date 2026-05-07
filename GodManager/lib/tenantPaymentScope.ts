import type { User } from '@prisma/client';
import type { ClientScopeUser } from '@/lib/clientScope';
import { prisma } from '@/lib/db';

export function tenantPaymentAndBatchWhere(user: ClientScopeUser): { clientId: string } | Record<string, never> {
  if (user.role === 'super_admin') return {};
  if (!user.clientId) return { clientId: '__no_access__' };
  return { clientId: user.clientId };
}

export async function resolveTenantPaymentClientId(user: User): Promise<string | null> {
  if (user.role !== 'super_admin') {
    return user.clientId;
  }
  if (user.clientId) return user.clientId;
  const mp = await prisma.client.findFirst({
    where: { companyName: 'Manager Prop' },
    select: { id: true },
  });
  return mp?.id ?? null;
}
