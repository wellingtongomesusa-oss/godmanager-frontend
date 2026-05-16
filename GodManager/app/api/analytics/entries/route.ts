import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveAnalyticsClientId } from '@/lib/analyticsResolveClientId';
import { GLEntryPaidStatus, GLEntryType, Prisma, UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

const ENTRY_TYPES = new Set<string>(Object.values(GLEntryType));
const PAID_STATUSES = new Set<string>(Object.values(GLEntryPaidStatus));

export async function GET(req: Request) {
  try {
    const user = await getCurrentUserFromSession();
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    if (user.role !== UserRole.super_admin) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const clientId = await resolveAnalyticsClientId(user, req);
    if (!clientId) {
      return NextResponse.json({ ok: false, error: 'No clientId resolved' }, { status: 400 });
    }

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(200, Math.max(10, parseInt(url.searchParams.get('pageSize') || '50', 10)));
    const type = url.searchParams.get('type') || '';
    const payee = url.searchParams.get('payee') || '';
    const accountCode = url.searchParams.get('accountCode') || '';
    const periodYM = url.searchParams.get('period') || '';
    const paidStatus = url.searchParams.get('paidStatus') || '';
    const search = url.searchParams.get('search') || '';

    const andParts: Prisma.GLEntryWhereInput[] = [{ clientId }];

    if (type && ENTRY_TYPES.has(type)) {
      andParts.push({ entryType: type as GLEntryType });
    }
    if (payee) andParts.push({ payee });
    if (accountCode) andParts.push({ accountCode });
    if (paidStatus && PAID_STATUSES.has(paidStatus)) {
      andParts.push({ paidStatus: paidStatus as GLEntryPaidStatus });
    }
    if (periodYM && /^\d{4}-\d{2}$/.test(periodYM)) {
      const [y, m] = periodYM.split('-').map(Number);
      andParts.push({
        entryDate: { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) },
      });
    }
    if (search.trim()) {
      const q = search.trim();
      andParts.push({
        OR: [
          { payee: { contains: q, mode: 'insensitive' } },
          { propertyAddress: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { reference: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.GLEntryWhereInput =
      andParts.length === 1 ? andParts[0] : { AND: andParts };

    const [total, entries] = await Promise.all([
      prisma.gLEntry.count({ where }),
      prisma.gLEntry.findMany({
        where,
        orderBy: { entryDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          propertyAddress: true,
          entryDate: true,
          payee: true,
          entryType: true,
          reference: true,
          debit: true,
          credit: true,
          balance: true,
          description: true,
          account: true,
          accountCode: true,
          paidStatus: true,
          paidAt: true,
          paidByName: true,
          paidMethod: true,
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      entries: entries.map((e) => ({
        ...e,
        debit: e.debit?.toString() || null,
        credit: e.credit?.toString() || null,
        balance: e.balance?.toString() || null,
      })),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown';
    console.error('analytics entries error:', e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
