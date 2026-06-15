import { NextResponse } from 'next/server';
import { getCurrentUserFromSession } from '@/lib/authServer';
import {
  getClientScopeForCreate,
  toClientScopeUser,
  type ClientScopeUser,
} from '@/lib/clientScope';
import { generateUploadUrl, publicUrlForKey } from '@/lib/r2';

export const dynamic = 'force-dynamic';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp']);

function resolveClientId(scopeUser: ClientScopeUser, bodyClientId: unknown): string | null {
  const scoped = getClientScopeForCreate(scopeUser);
  if (scoped) return scoped;
  if (typeof bodyClientId === 'string' && bodyClientId.trim()) {
    return bodyClientId.trim();
  }
  return null;
}

function normalizeExt(ext: unknown): string {
  const raw = typeof ext === 'string' ? ext.trim().toLowerCase() : 'jpg';
  const cleaned = raw.replace(/[^a-z]/g, '');
  if (cleaned === 'jpeg') return 'jpg';
  if (ALLOWED_EXT.has(cleaned)) return cleaned === 'jpeg' ? 'jpg' : cleaned;
  return 'jpg';
}

function safeClientIdSegment(clientId: string): string {
  const safe = clientId.replace(/[^a-zA-Z0-9_-]/g, '');
  return safe || '';
}

export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const scopeUser = toClientScopeUser(user);

  try {
    const body = await req.json().catch(() => ({}));
    const clientId = resolveClientId(scopeUser, body?.clientId);
    if (!clientId) {
      return NextResponse.json({ error: 'no client' }, { status: 400 });
    }

    const safeClientId = safeClientIdSegment(clientId);
    if (!safeClientId) {
      return NextResponse.json({ error: 'invalid clientId' }, { status: 400 });
    }

    const contentType =
      typeof body?.contentType === 'string' ? String(body.contentType).trim() : '';
    if (!contentType || !ALLOWED_CONTENT_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: `contentType must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    const ext = normalizeExt(body?.ext);
    const key = `client-logos/${safeClientId}/logo-${Date.now()}.${ext}`;

    const uploadUrl = await generateUploadUrl(key, contentType, 300);
    const publicUrl = publicUrlForKey(key);

    return NextResponse.json({
      ok: true,
      uploadUrl,
      publicUrl,
      key,
      expiresInSeconds: 300,
    });
  } catch (err: unknown) {
    console.error('[POST /api/client/logo/presigned-url]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
