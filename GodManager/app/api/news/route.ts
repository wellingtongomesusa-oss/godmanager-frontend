import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { recordAudit } from '@/lib/auditServer';
import {
  canAccessClientId,
  getClientScopeForCreate,
  getClientScopeWhere,
  toClientScopeUser,
} from '@/lib/clientScope';

export const dynamic = 'force-dynamic';

const NEWS_POST_ROLES = new Set(['admin', 'super_admin', 'manager', 'maintenance']);

function serialize(row: {
  id: string;
  clientId: string;
  type: string;
  subtype: string | null;
  title: string;
  body: string | null;
  jobId: string | null;
  metadata: Prisma.JsonValue | null;
  createdById: string | null;
  createdByEmail: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    clientId: row.clientId,
    type: row.type,
    subtype: row.subtype,
    title: row.title,
    body: row.body,
    jobId: row.jobId,
    metadata: row.metadata,
    createdById: row.createdById,
    createdByEmail: row.createdByEmail,
    createdAt: row.createdAt.toISOString(),
  };
}

function parseSince24h(since: string | null): Date | null {
  if (!since) return null;
  const s = since.trim().toLowerCase();
  if (s === '24h' || s === '24') {
    return new Date(Date.now() - 24 * 60 * 60 * 1000);
  }
  const d = new Date(since);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function resolveClientIdForCreate(
  scopeUser: ReturnType<typeof toClientScopeUser>,
  user: { role: string; clientId: string | null },
  body: { clientId?: unknown; jobId?: unknown },
): Promise<string | null> {
  let clientId = getClientScopeForCreate(scopeUser);
  if (clientId === null && user.role === 'super_admin') {
    const raw = body.clientId;
    clientId = raw != null && String(raw).trim() !== '' ? String(raw).trim() : null;
  }
  if (clientId) return clientId;

  const jobId = body.jobId != null ? String(body.jobId).trim() : '';
  if (!jobId) return null;

  const exp = await prisma.pmExpense.findUnique({
    where: { id: jobId },
    select: { clientId: true, property: { select: { clientId: true } } },
  });
  if (!exp) return null;
  return exp.clientId ?? exp.property?.clientId ?? null;
}

export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const scopeUser = toClientScopeUser(user);
    const url = new URL(req.url);
    const rawLimit = Number(url.searchParams.get('limit'));
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;
    const sinceParam = url.searchParams.get('since');
    const sinceDate = parseSince24h(sinceParam);

    const scopeWhere = getClientScopeWhere(scopeUser);
    const items = await prisma.teamNewsItem.findMany({
      where: scopeWhere,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const total24h = await prisma.teamNewsItem.count({
      where: {
        ...scopeWhere,
        createdAt: { gte: sinceDate ?? cutoff24h },
      },
    });

    return NextResponse.json({
      ok: true,
      items: items.map(serialize),
      count: items.length,
      total_24h: total24h,
    });
  } catch (e) {
    console.error('[GET /api/news]', e);
    return NextResponse.json({ ok: false, error: 'Failed to list news' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const role = String(user.role || '').toLowerCase();
  if (!NEWS_POST_ROLES.has(role)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
    }

    const type = String(body.type || '').trim();
    const title = String(body.title || '').trim().slice(0, 120);
    if (!type || !title) {
      return NextResponse.json({ ok: false, error: 'type and title required' }, { status: 400 });
    }

    const scopeUser = toClientScopeUser(user);
    const clientId = await resolveClientIdForCreate(scopeUser, user, body);
    if (!clientId) {
      return NextResponse.json({ ok: false, error: 'clientId could not be resolved' }, { status: 400 });
    }
    if (!canAccessClientId(scopeUser, clientId)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const jobId = body.jobId != null && String(body.jobId).trim() !== '' ? String(body.jobId).trim() : null;
    if (jobId) {
      const exp = await prisma.pmExpense.findUnique({
        where: { id: jobId },
        select: { clientId: true, property: { select: { clientId: true } } },
      });
      if (!exp) {
        return NextResponse.json({ ok: false, error: 'job not found' }, { status: 404 });
      }
      const eff = exp.clientId ?? exp.property?.clientId ?? null;
      if (!canAccessClientId(scopeUser, eff)) {
        return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
      }
    }

    const subtype =
      body.subtype != null && String(body.subtype).trim() !== ''
        ? String(body.subtype).trim().slice(0, 40)
        : null;
    const bodyText =
      body.body != null && String(body.body).trim() !== '' ? String(body.body).trim() : null;
    const metadata =
      body.metadata && typeof body.metadata === 'object'
        ? (body.metadata as Prisma.InputJsonValue)
        : undefined;

    const created = await prisma.teamNewsItem.create({
      data: {
        clientId,
        type: type.slice(0, 40),
        subtype,
        title,
        body: bodyText,
        jobId,
        metadata,
        createdById: user.id,
        createdByEmail: user.email,
      },
    });

    await recordAudit({
      request: req,
      actor: { id: user.id, email: user.email },
      action: 'news.create',
      entity: 'news',
      entityId: created.id,
      clientId,
      details: JSON.stringify({ type, subtype, jobId, title: title.slice(0, 80) }),
    });

    return NextResponse.json({ ok: true, item: serialize(created) });
  } catch (e) {
    console.error('[POST /api/news]', e);
    return NextResponse.json({ ok: false, error: 'Failed to create news' }, { status: 500 });
  }
}
