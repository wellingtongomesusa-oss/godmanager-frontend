import type { User } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/db';

/** super_admin sem tenant: query ?clientId=, header x-client-id, ou primeiro cliente na BD. */
export async function resolveAnalyticsClientId(user: User, req: Request): Promise<string | null> {
  let clientId = user.clientId;
  if (!clientId && user.role === UserRole.super_admin) {
    const url = new URL(req.url);
    clientId =
      url.searchParams.get('clientId')?.trim() ||
      req.headers.get('x-client-id')?.trim() ||
      null;
    if (!clientId) {
      const firstClient = await prisma.client.findFirst({
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      clientId = firstClient?.id ?? null;
    }
  }
  return clientId;
}
