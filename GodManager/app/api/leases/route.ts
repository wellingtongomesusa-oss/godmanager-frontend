import { NextResponse } from 'next/server';
import { LeaseStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveAnalyticsClientId } from '@/lib/analyticsResolveClientId';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function utcStartOfToday(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 0, 0, 0, 0));
}

function addUtcDays(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

const LEASE_STATUSES = new Set(Object.values(LeaseStatus));

/** GET /api/leases — list + summary cards para Histórico de contratos */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUserFromSession();
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const clientId = await resolveAnalyticsClientId(user, req);
    if (!clientId) return NextResponse.json({ ok: false, error: 'No client context' }, { status: 400 });

    const url = new URL(req.url);
    const statusParam = url.searchParams.get('status') || '';
    const expireWithinRaw = url.searchParams.get('expireWithin') || '';
    const expireWithin =
      expireWithinRaw === '' || expireWithinRaw === 'all'
        ? null
        : Math.min(366, Math.max(1, parseInt(expireWithinRaw, 10) || 0)) || null;
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();

    const today = utcStartOfToday();

    const baseWhere: Prisma.LeaseWhereInput = { clientId };
    let where: Prisma.LeaseWhereInput = { ...baseWhere };

    if (statusParam && LEASE_STATUSES.has(statusParam as LeaseStatus)) {
      where = { ...where, status: statusParam as LeaseStatus };
    }

    if (expireWithin !== null && (!statusParam || statusParam === 'ACTIVE')) {
      const untilEnd = addUtcDays(today, expireWithin);
      where = {
        ...where,
        status: LeaseStatus.ACTIVE,
        leaseEnd: { not: null, gte: today, lte: untilEnd },
      };
    }

    if (q) {
      where = {
        AND: [
          where,
          {
            OR: [
              { propertyAddress: { contains: q, mode: 'insensitive' } },
              { tenantName: { contains: q, mode: 'insensitive' } },
            ],
          },
        ],
      };
    }

    const until30 = addUtcDays(today, 30);
    const until60 = addUtcDays(today, 60);
    const until90 = addUtcDays(today, 90);

    const [active, expire30, expire60, expire90, expired, future, leases] = await Promise.all([
      prisma.lease.count({ where: { clientId, status: LeaseStatus.ACTIVE } }),
      prisma.lease.count({
        where: {
          clientId,
          status: LeaseStatus.ACTIVE,
          leaseEnd: { not: null, gte: today, lte: until30 },
        },
      }),
      prisma.lease.count({
        where: {
          clientId,
          status: LeaseStatus.ACTIVE,
          leaseEnd: { not: null, gte: today, lte: until60 },
        },
      }),
      prisma.lease.count({
        where: {
          clientId,
          status: LeaseStatus.ACTIVE,
          leaseEnd: { not: null, gte: today, lte: until90 },
        },
      }),
      prisma.lease.count({ where: { clientId, status: LeaseStatus.EXPIRED } }),
      prisma.lease.count({ where: { clientId, status: LeaseStatus.FUTURE } }),
      prisma.lease.findMany({
        where,
        orderBy: [{ leaseEnd: 'asc' }, { propertyAddress: 'asc' }],
        take: 500,
        select: {
          id: true,
          propertyAddress: true,
          unit: true,
          tenantName: true,
          leaseStart: true,
          leaseEnd: true,
          monthlyRent: true,
          securityDeposit: true,
          status: true,
          propertyId: true,
          tenantId: true,
          notes: true,
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      clientId,
      summary: {
        active,
        expiring30: expire30,
        expiring60: expire60,
        expiring90: expire90,
        expired,
        future,
      },
      leases: leases.map((l) => ({
        ...l,
        monthlyRent: l.monthlyRent != null ? String(l.monthlyRent) : null,
        securityDeposit: l.securityDeposit != null ? String(l.securityDeposit) : null,
        leaseStart: l.leaseStart?.toISOString() ?? null,
        leaseEnd: l.leaseEnd?.toISOString() ?? null,
        matchedProperty: Boolean(l.propertyId),
        matchedTenant: Boolean(l.tenantId),
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    console.error('[leases GET]', e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
