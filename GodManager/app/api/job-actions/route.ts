import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

function serialize(a: {
  id: string;
  jobId: string;
  jobType: string;
  action: string;
  reason: string | null;
  actorId: string | null;
  actorEmail: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
}) {
  return {
    id: a.id,
    jobId: a.jobId,
    jobType: a.jobType,
    action: a.action,
    reason: a.reason,
    actorId: a.actorId,
    actorEmail: a.actorEmail,
    metadata: a.metadata,
    createdAt: a.createdAt.toISOString(),
  };
}

export async function GET(req: Request) {
  const u = await getCurrentUserFromSession();
  if (!u) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const url = new URL(req.url);
    const jobId = url.searchParams.get('jobId');
    const action = url.searchParams.get('action');
    const rawLimit = Number(url.searchParams.get('limit'));
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : 200;
    const where: Prisma.JobActionWhereInput = {};
    if (jobId) where.jobId = jobId;
    if (action) where.action = action;
    const actions = await prisma.jobAction.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    });
    return NextResponse.json({ ok: true, actions: actions.map(serialize) });
  } catch (e) {
    console.error('[GET /api/job-actions]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const u = await getCurrentUserFromSession();
  if (!u) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').trim().slice(0, 40);
    const jobId = String(body?.jobId || '').trim();
    if (!action || !jobId) {
      return NextResponse.json({ ok: false, error: 'action and jobId required' }, { status: 400 });
    }
    const created = await prisma.jobAction.create({
      data: {
        jobId,
        jobType: typeof body?.jobType === 'string' && body.jobType ? body.jobType : 'expense',
        action,
        reason: body?.reason ? String(body.reason) : null,
        actorId: u.id,
        actorEmail: u.email,
        metadata:
          body?.metadata && typeof body.metadata === 'object' ? (body.metadata as object) : undefined,
      },
    });
    await prisma.auditEntry
      .create({
        data: {
          actorId: u.id,
          actorEmail: u.email,
          action: 'job_' + action,
          entity: 'job',
          entityId: jobId,
          details: JSON.stringify({ reason: body?.reason || null, jobType: created.jobType }),
        },
      })
      .catch(() => {});
    return NextResponse.json({ ok: true, jobAction: serialize(created) });
  } catch (e) {
    console.error('[POST /api/job-actions]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
