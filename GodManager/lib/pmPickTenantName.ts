import { LeaseStatus, Prisma } from '@prisma/client';

export type PropertyTenantPickInput = {
  tenants: { id: string; name: string; status: string }[];
  leases: {
    status: LeaseStatus;
    tenantId: string | null;
    tenantName: string;
    tenant: { name: string } | null;
  }[];
};

/** Prioriza lease ACTIVE; fallback tenant active; depois primeiro tenant. */
export function pickTenantNameForProperty(property: PropertyTenantPickInput): string | null {
  const activeLeases = property.leases.filter((l) => l.status === LeaseStatus.ACTIVE);
  for (const lease of activeLeases) {
    const fromLinked = lease.tenant?.name?.trim();
    if (fromLinked) return fromLinked;
    const fromLease = lease.tenantName?.trim();
    if (fromLease) return fromLease;
    if (lease.tenantId) {
      const t = property.tenants.find((x) => x.id === lease.tenantId);
      if (t?.name?.trim()) return t.name.trim();
    }
  }
  const activeTenant = property.tenants.find((t) => String(t.status).toLowerCase() === 'active');
  if (activeTenant?.name?.trim()) return activeTenant.name.trim();
  const first = property.tenants[0];
  if (first?.name?.trim()) return first.name.trim();
  return null;
}

export const pmExpensePropertyTenantSelect = {
  code: true,
  address: true,
  ownerName: true,
  tenants: {
    select: { id: true, name: true, status: true },
    orderBy: { name: Prisma.SortOrder.asc },
  },
  leases: {
    select: {
      status: true,
      tenantId: true,
      tenantName: true,
      tenant: { select: { name: true } },
    },
    where: { status: LeaseStatus.ACTIVE },
    orderBy: [{ leaseEnd: Prisma.SortOrder.desc }, { updatedAt: Prisma.SortOrder.desc }],
    take: 8,
  },
};
