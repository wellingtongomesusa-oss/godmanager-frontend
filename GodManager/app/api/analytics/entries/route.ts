import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveAnalyticsClientId } from '@/lib/analyticsResolveClientId';
import { UserRole } from '@prisma/client';
import { buildAnalyticsGLEntryFilters } from '@/lib/analyticsGLEntryFilters';

export const dynamic = 'force-dynamic';

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

    const { where } = buildAnalyticsGLEntryFilters(clientId, url.searchParams);

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
          paidNotes: true,
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
