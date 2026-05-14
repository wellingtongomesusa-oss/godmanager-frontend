import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { canAccessClientId, toClientScopeUser } from '@/lib/clientScope';

export const dynamic = 'force-dynamic';

/** PATCH /api/comments/[id]  { content?, metadata? } */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = params;
    const body = (await req.json()) as Record<string, unknown>;

    const existing = await prisma.comment.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    const scopeUser = toClientScopeUser(user);
    if (!canAccessClientId(scopeUser, existing.clientId)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    if (existing.authorId !== user.id && user.role !== 'super_admin') {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const data: Prisma.CommentUpdateInput = {};
    if (typeof body.content === 'string' && body.content.trim().length > 0) {
      data.content = body.content.trim();
    }
    if (body.metadata !== undefined) {
      data.metadata =
        body.metadata === null
          ? Prisma.DbNull
          : (body.metadata as Prisma.InputJsonValue);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: 'No valid fields to update' }, { status: 400 });
    }

    const updated = await prisma.comment.update({ where: { id }, data });
    return NextResponse.json({ ok: true, comment: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed';
    console.error('[PATCH /api/comments/:id]', e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** DELETE /api/comments/[id] (soft delete) */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = params;

    const existing = await prisma.comment.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    const scopeUser = toClientScopeUser(user);
    if (!canAccessClientId(scopeUser, existing.clientId)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    if (existing.authorId !== user.id && user.role !== 'super_admin') {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    await prisma.comment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed';
    console.error('[DELETE /api/comments/:id]', e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
