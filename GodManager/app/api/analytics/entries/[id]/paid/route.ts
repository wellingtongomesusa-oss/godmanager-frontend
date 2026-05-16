import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveAnalyticsClientId } from '@/lib/analyticsResolveClientId';
import { GLEntryPaidStatus, UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

function jsonGLEntry(e: Record<string, unknown>) {
  return {
    ...e,
    debit: e.debit != null ? String(e.debit) : null,
    credit: e.credit != null ? String(e.credit) : null,
    balance: e.balance != null ? String(e.balance) : null,
  };
}

// PATCH { action: 'mark_paid' | 'revert', paidAt?, method?, notes? }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
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

    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const action = String(body?.action || '').toLowerCase();

    const entry = await prisma.gLEntry.findFirst({ where: { id: params.id, clientId } });
    if (!entry) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

    const authorName =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email;

    if (action === 'mark_paid') {
      const paidAt = body.paidAt ? new Date(String(body.paidAt)) : new Date();
      const method = body.method ? String(body.method).slice(0, 40) : null;
      const notes = body.notes ? String(body.notes).slice(0, 1000) : null;

      const updated = await prisma.gLEntry.update({
        where: { id: entry.id },
        data: {
          paidStatus: GLEntryPaidStatus.PAID,
          paidAt,
          paidById: user.id,
          paidByName: authorName,
          paidMethod: method,
          paidNotes: notes,
        },
      });

      return NextResponse.json({
        ok: true,
        entry: jsonGLEntry(updated as unknown as Record<string, unknown>),
      });
    }

    if (action === 'revert') {
      const updated = await prisma.gLEntry.update({
        where: { id: entry.id },
        data: {
          paidStatus: GLEntryPaidStatus.UNPAID,
          paidAt: null,
          paidById: null,
          paidByName: null,
          paidMethod: null,
          paidNotes: null,
        },
      });

      return NextResponse.json({
        ok: true,
        entry: jsonGLEntry(updated as unknown as Record<string, unknown>),
      });
    }

    return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown';
    console.error('mark-paid error:', e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
