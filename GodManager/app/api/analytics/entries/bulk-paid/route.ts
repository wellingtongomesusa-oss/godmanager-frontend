import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveAnalyticsClientId } from '@/lib/analyticsResolveClientId';
import { GLEntryPaidStatus, UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

// POST { ids: string[], paidAt?, method?, notes? }
export async function POST(req: Request) {
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

    let body: { ids?: unknown; paidAt?: unknown; method?: unknown; notes?: unknown } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const ids: string[] = Array.isArray(body?.ids)
      ? body.ids.filter((s): s is string => typeof s === 'string').slice(0, 500)
      : [];
    if (ids.length === 0) return NextResponse.json({ ok: false, error: 'No ids' }, { status: 400 });

    const authorName =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email;
    const paidAt = body.paidAt ? new Date(String(body.paidAt)) : new Date();
    const method = body.method ? String(body.method).slice(0, 40) : null;
    const notes = body.notes ? String(body.notes).slice(0, 1000) : null;

    const result = await prisma.gLEntry.updateMany({
      where: { id: { in: ids }, clientId, paidStatus: GLEntryPaidStatus.UNPAID },
      data: {
        paidStatus: GLEntryPaidStatus.PAID,
        paidAt,
        paidById: user.id,
        paidByName: authorName,
        paidMethod: method,
        paidNotes: notes,
      },
    });

    return NextResponse.json({ ok: true, updated: result.count, requested: ids.length });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
