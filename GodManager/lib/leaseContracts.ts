import type { LeaseContract, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

export type ActiveTenantRow = { id: string; name: string };

export type ActiveTenantResolution = {
  kind: 'one' | 'none' | 'many';
  tenants: ActiveTenantRow[];
};

/** UTC calendar day from date (for code suffix MMDDYYYY). */
export function utcDayParts(d: Date): { mm: string; dd: string; yyyy: string } {
  return {
    mm: String(d.getUTCMonth() + 1).padStart(2, '0'),
    dd: String(d.getUTCDate()).padStart(2, '0'),
    yyyy: String(d.getUTCFullYear()),
  };
}

export function utcTodayStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function parseMoveInDate(value: unknown): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

export function parseOptionalMoveOutDate(value: unknown): Date | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return utcTodayStart();
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

/** Base human label: {propertyCode}TN{MMDDYYYY} (UTC). */
export function leaseContractCodeBase(propertyCode: string, moveInDate: Date): string {
  const pc = String(propertyCode || '').trim();
  const { mm, dd, yyyy } = utcDayParts(moveInDate);
  return `${pc}TN${mm}${dd}${yyyy}`;
}

/** Allocates unique code; on collision adds -2, -3, … */
export async function leaseContractCode(
  propertyCode: string,
  moveInDate: Date,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<string> {
  const base = leaseContractCodeBase(propertyCode, moveInDate);
  let candidate = base;
  let suffix = 2;
  for (let i = 0; i < 50; i++) {
    const hit = await tx.leaseContract.findFirst({
      where: { code: candidate },
      select: { id: true },
    });
    if (!hit) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  throw new Error('Failed to allocate lease contract code');
}

export async function resolveActiveTenant(
  propertyId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<ActiveTenantResolution> {
  const rows = await tx.tenant.findMany({
    where: {
      propertyId,
      status: { in: ['active', 'notice'] },
    },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  if (rows.length === 0) return { kind: 'none', tenants: [] };
  if (rows.length === 1) return { kind: 'one', tenants: rows };
  return { kind: 'many', tenants: rows };
}

export function leaseContractToJson(
  c: LeaseContract,
  opts?: { tenantName?: string | null },
) {
  return {
    id: c.id,
    clientId: c.clientId,
    propertyId: c.propertyId,
    tenantId: c.tenantId,
    tenantName: opts?.tenantName ?? null,
    code: c.code,
    moveIn: c.moveIn.toISOString(),
    moveOut: c.moveOut ? c.moveOut.toISOString() : null,
    status: c.status,
    notes: c.notes,
    monthlyRent: c.monthlyRent != null ? c.monthlyRent.toString() : null,
    deposit: c.deposit != null ? c.deposit.toString() : null,
    graceDays: c.graceDays,
    lateFeePct: c.lateFeePct != null ? c.lateFeePct.toString() : null,
    monthlyInterestPct: c.monthlyInterestPct != null ? c.monthlyInterestPct.toString() : null,
    prorateFirstMonth: c.prorateFirstMonth,
    createdById: c.createdById,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export async function fetchTenantNamesById(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, string>();
  if (!unique.length) return map;
  const rows = await prisma.tenant.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true },
  });
  for (const r of rows) map.set(r.id, r.name);
  return map;
}
