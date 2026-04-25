import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

export async function getEffectiveMonthlyRent(propertyId: string): Promise<number> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { rent: true },
  });
  const base = property ? Number(property.rent) : 0;

  const tenant = await prisma.tenant.findFirst({
    where: { propertyId, status: 'active' },
    orderBy: { rent: 'desc' },
    select: { rent: true },
  });
  const tr = tenant ? Number(tenant.rent) : 0;
  return tr > 0 ? tr : base;
}

export function dec(n: Prisma.Decimal | number | null | undefined): number {
  if (n == null) return 0;
  if (typeof n === 'number') return n;
  return Number(n);
}
