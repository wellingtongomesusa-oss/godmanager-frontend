import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = new Set([
  'wellington.gomes@godmanager.com',
  'wellingtongomesusa@gmail.com',
]);

function isAdmin(user: { id: string; email: string; role: string } | null | undefined) {
  if (!user) return false;
  const roleLower = String(user.role || '').toLowerCase();
  if (roleLower === 'admin' || roleLower === 'super_admin') return true;
  const email = String(user.email || '').toLowerCase();
  if (!email) return false;
  if (ADMIN_EMAILS.has(email)) return true;
  if (email.indexOf('admin') >= 0) return true;
  return false;
}

function serialize(e: {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  targetUserId: string | null;
  details: string;
  ip: string | null;
  userAgent: string | null;
  timestamp: Date;
}) {
  let details: unknown = e.details;
  if (typeof e.details === 'string' && e.details.length > 0) {
    try {
      details = JSON.parse(e.details);
    } catch {
      details = e.details;
    }
  } else {
    details = null;
  }
  return {
    id: e.id,
    actorId: e.actorId,
    actorEmail: e.actorEmail ?? '',
    action: e.action,
    entity: e.entity,
    entityId: e.entityId,
    targetUserId: e.targetUserId,
    details,
    ip: e.ip ?? '',
    userAgent: e.userAgent ?? '',
    timestamp: e.timestamp.toISOString(),
    createdAt: e.timestamp.toISOString(),
  };
}

export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').trim().slice(0, 80);
    const entity = String(body?.entity || '').trim().slice(0, 80);
    if (!action) {
      return NextResponse.json({ ok: false, error: 'action required' }, { status: 400 });
    }
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      null;
    const userAgent = req.headers.get('user-agent')?.slice(0, 400) || null;
    let detailsStr = '';
    if (body?.details != null) {
      try {
        detailsStr =
          typeof body.details === 'string' ? body.details : JSON.stringify(body.details);
      } catch {
        detailsStr = '';
      }
      if (detailsStr.length > 4000) detailsStr = detailsStr.slice(0, 4000);
    }
    const created = await prisma.auditEntry.create({
      data: {
        actorId: user?.id ?? null,
        actorEmail: user?.email ?? (typeof body?.actorEmail === 'string' ? body.actorEmail : null),
        action,
        entity,
        entityId: body?.entityId ? String(body.entityId).slice(0, 200) : null,
        details: detailsStr,
        ip,
        userAgent,
      },
    });
    return NextResponse.json({ ok: true, entry: serialize(created) });
  } catch (e) {
    console.error('[POST /api/audit]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user))
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  try {
    const url = new URL(req.url);
    const entity = url.searchParams.get('entity');
    const action = url.searchParams.get('action');
    const actorEmail = url.searchParams.get('actor');
    const fromStr = url.searchParams.get('from');
    const toStr = url.searchParams.get('to');
    const rawLimit = Number(url.searchParams.get('limit'));
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : 200;

    const where: Prisma.AuditEntryWhereInput = {};
    if (entity) where.entity = entity;
    if (action) where.action = action;
    if (actorEmail) where.actorEmail = { contains: actorEmail, mode: 'insensitive' };
    if (fromStr || toStr) {
      const range: Prisma.DateTimeFilter = {};
      if (fromStr) {
        const f = new Date(fromStr);
        if (!Number.isNaN(f.getTime())) range.gte = f;
      }
      if (toStr) {
        const t = new Date(toStr);
        if (!Number.isNaN(t.getTime())) range.lte = t;
      }
      if (range.gte || range.lte) where.timestamp = range;
    }

    const entries = await prisma.auditEntry.findMany({
      where,
      orderBy: [{ timestamp: 'desc' }],
      take: limit,
    });
    return NextResponse.json({ ok: true, entries: entries.map(serialize) });
  } catch (e) {
    console.error('[GET /api/audit]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
