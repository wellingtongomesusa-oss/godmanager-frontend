import { NextRequest, NextResponse } from 'next/server';
import { CommentEntityType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import {
  canAccessClientId,
  getClientScopeWhere,
  toClientScopeUser,
} from '@/lib/clientScope';

export const dynamic = 'force-dynamic';

const ENTITY_TYPES = new Set<string>(Object.values(CommentEntityType));

function canSeeInternalComments(role: string): boolean {
  return ['super_admin', 'admin', 'manager', 'accountant'].includes(role);
}

function canSetInternalComment(role: string): boolean {
  return ['super_admin', 'admin', 'manager'].includes(role);
}

/** GET /api/comments?entityType=JOB&entityId=xxx */
export async function GET(req: NextRequest) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');

    if (!entityType || !entityId) {
      return NextResponse.json(
        { ok: false, error: 'entityType and entityId required' },
        { status: 400 },
      );
    }

    if (!ENTITY_TYPES.has(entityType)) {
      return NextResponse.json({ ok: false, error: 'Invalid entityType' }, { status: 400 });
    }

    const scopeUser = toClientScopeUser(user);
    const scope = getClientScopeWhere(scopeUser);
    const privileged = canSeeInternalComments(user.role);

    const where: Prisma.CommentWhereInput = {
      ...scope,
      entityType: entityType as CommentEntityType,
      entityId,
      deletedAt: null,
      ...(privileged ? {} : { isInternal: false }),
    };

    const comments = await prisma.comment.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ ok: true, comments });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed';
    console.error('[GET /api/comments]', e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** POST /api/comments  { entityType, entityId, content, metadata?, isInternal?, clientId? } */
export async function POST(req: NextRequest) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const entityType = body.entityType;
    const entityId = body.entityId;
    const content = body.content;
    const metadata = body.metadata;
    const isInternal = body.isInternal;
    const bodyClientId = body.clientId;

    if (
      typeof entityType !== 'string' ||
      typeof entityId !== 'string' ||
      content == null ||
      String(content).trim().length === 0
    ) {
      return NextResponse.json(
        { ok: false, error: 'entityType, entityId, content required' },
        { status: 400 },
      );
    }

    if (!ENTITY_TYPES.has(entityType)) {
      return NextResponse.json({ ok: false, error: 'Invalid entityType' }, { status: 400 });
    }

    const scopeUser = toClientScopeUser(user);

    let clientId: string;
    if (user.role === 'super_admin') {
      const raw =
        bodyClientId != null && String(bodyClientId).trim() !== ''
          ? String(bodyClientId).trim()
          : user.clientId;
      if (!raw) {
        return NextResponse.json(
          { ok: false, error: 'clientId required for super_admin without user.clientId' },
          { status: 400 },
        );
      }
      clientId = raw;
    } else {
      if (!user.clientId) {
        return NextResponse.json({ ok: false, error: 'User has no clientId' }, { status: 400 });
      }
      clientId = user.clientId;
    }

    if (!canAccessClientId(scopeUser, clientId)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const authorName =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      user.email ||
      'Unknown';

    const internal = canSetInternalComment(user.role) && !!isInternal;

    const comment = await prisma.comment.create({
      data: {
        clientId,
        entityType: entityType as CommentEntityType,
        entityId,
        authorId: user.id,
        authorName,
        authorRole: user.role,
        content: String(content).trim(),
        ...(metadata === undefined
          ? {}
          : {
              metadata:
                metadata === null
                  ? Prisma.DbNull
                  : (metadata as Prisma.InputJsonValue),
            }),
        isInternal: internal,
      },
    });

    return NextResponse.json({ ok: true, comment });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed';
    console.error('[POST /api/comments]', e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
