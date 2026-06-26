import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';
import { generateUploadUrl, publicUrlForKey } from '@/lib/r2';

export const dynamic = 'force-dynamic';

const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
] as const;

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const EXPIRES_IN_SECONDS = 300;

function randomString(length: number): string {
  return randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

function extensionForContentType(contentType: string): string {
  if (contentType === 'application/pdf') return 'pdf';
  if (contentType === 'image/png') return 'png';
  return 'jpg';
}

function sanitizeFolderId(raw: string): string | null {
  const safe = String(raw || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
  return safe || null;
}

/** POST /api/billing/attachments/presigned-url — presigned upload for bill attachments */
export async function POST(req: NextRequest) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const documentId = body.documentId != null ? String(body.documentId).trim() : '';
    const tempUploadId = body.tempUploadId != null ? String(body.tempUploadId).trim() : '';
    const contentType = body.contentType;
    const sizeBytes = body.sizeBytes;

    const scopeUser = toClientScopeUser(user);
    let clientPart = scopeUser.clientId || 'no-client';
    let folderId: string | null = null;

    if (documentId) {
      const doc = await prisma.billingDocument.findFirst({
        where: { id: documentId, ...getClientScopeWhere(scopeUser) },
        select: { id: true, clientId: true },
      });
      if (!doc) {
        return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
      }
      folderId = sanitizeFolderId(doc.id);
      if (doc.clientId) clientPart = doc.clientId;
    } else if (tempUploadId) {
      const safe = sanitizeFolderId(tempUploadId);
      if (!safe || !safe.startsWith('temp-')) {
        return NextResponse.json({ ok: false, error: 'invalid tempUploadId' }, { status: 400 });
      }
      folderId = safe;
    } else {
      return NextResponse.json(
        { ok: false, error: 'documentId or tempUploadId required' },
        { status: 400 }
      );
    }

    if (!folderId) {
      return NextResponse.json({ ok: false, error: 'invalid folder id' }, { status: 400 });
    }

    const ct = String(contentType || '').trim().toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.includes(ct as (typeof ALLOWED_CONTENT_TYPES)[number])) {
      return NextResponse.json({ ok: false, error: 'invalid contentType' }, { status: 400 });
    }

    const size = typeof sizeBytes === 'number' ? sizeBytes : Number(sizeBytes);
    if (!Number.isFinite(size) || size < 1 || size > MAX_SIZE_BYTES) {
      return NextResponse.json({ ok: false, error: 'invalid sizeBytes' }, { status: 400 });
    }

    const ext = extensionForContentType(ct);
    const key = `billing-attachments/${clientPart}/${folderId}/${Date.now()}-${randomString(8)}.${ext}`;

    const uploadUrl = await generateUploadUrl(key, ct, EXPIRES_IN_SECONDS);
    const publicUrl = publicUrlForKey(key);

    return NextResponse.json({
      ok: true,
      uploadUrl,
      publicUrl,
      key,
      expiresInSeconds: EXPIRES_IN_SECONDS,
    });
  } catch (e) {
    console.error('[POST /api/billing/attachments/presigned-url]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
