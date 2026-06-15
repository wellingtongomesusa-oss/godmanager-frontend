import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import {
  canAccessClientId,
  getClientScopeForCreate,
  toClientScopeUser,
  type ClientScopeUser,
} from '@/lib/clientScope';

export const dynamic = 'force-dynamic';

function resolveClientIdFromBody(scopeUser: ClientScopeUser, bodyClientId: unknown): string | null {
  const scoped = getClientScopeForCreate(scopeUser);
  if (scoped) return scoped;
  if (typeof bodyClientId === 'string' && bodyClientId.trim()) {
    return bodyClientId.trim();
  }
  return null;
}

function resolveClientIdFromQuery(scopeUser: ClientScopeUser, queryClientId: string | null): string | null {
  const scoped = getClientScopeForCreate(scopeUser);
  if (scoped) return scoped;
  if (queryClientId && queryClientId.trim()) {
    return queryClientId.trim();
  }
  return null;
}

async function assertClientAccess(scopeUser: ClientScopeUser, clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, logoUrl: true, logoKey: true },
  });
  if (!client) {
    return { ok: false as const, status: 404, error: 'Client not found' };
  }
  if (!canAccessClientId(scopeUser, client.id)) {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }
  return { ok: true as const, client };
}

export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const scopeUser = toClientScopeUser(user);

  try {
    const { searchParams } = new URL(req.url);
    const clientId = resolveClientIdFromQuery(scopeUser, searchParams.get('clientId'));
    if (!clientId) {
      return NextResponse.json({ error: 'no client' }, { status: 400 });
    }

    const gate = await assertClientAccess(scopeUser, clientId);
    if (!gate.ok) {
      return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
    }

    return NextResponse.json({
      ok: true,
      logoUrl: gate.client.logoUrl || null,
    });
  } catch (err: unknown) {
    console.error('[GET /api/client/logo]', err);
    return NextResponse.json({ ok: false, error: 'Failed to load logo' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const scopeUser = toClientScopeUser(user);

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
    }

    const clientId = resolveClientIdFromBody(scopeUser, body.clientId);
    if (!clientId) {
      return NextResponse.json({ error: 'no client' }, { status: 400 });
    }

    const logoUrl = typeof body.logoUrl === 'string' ? body.logoUrl.trim() : '';
    const logoKey = typeof body.logoKey === 'string' ? body.logoKey.trim() : '';
    if (!logoUrl || !logoKey) {
      return NextResponse.json({ ok: false, error: 'logoUrl and logoKey are required' }, { status: 400 });
    }

    const gate = await assertClientAccess(scopeUser, clientId);
    if (!gate.ok) {
      return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
    }

    const updated = await prisma.client.update({
      where: { id: clientId },
      data: { logoUrl, logoKey },
      select: { logoUrl: true },
    });

    return NextResponse.json({ ok: true, logoUrl: updated.logoUrl });
  } catch (err: unknown) {
    console.error('[POST /api/client/logo]', err);
    return NextResponse.json({ ok: false, error: 'Failed to save logo' }, { status: 500 });
  }
}
