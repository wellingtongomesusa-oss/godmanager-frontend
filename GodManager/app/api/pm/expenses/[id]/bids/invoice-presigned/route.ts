import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { generateUploadUrl, publicUrlForKey } from '@/lib/r2';

export const dynamic = 'force-dynamic';

const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;

const BLOCKED_BID_STATUSES = new Set(['won', 'lost', 'expired']);
const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const EXPIRES_IN_SECONDS = 300;

function randomString(length: number): string {
  return randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

function extensionForContentType(contentType: string): string {
  if (contentType === 'application/pdf') return 'pdf';
  if (contentType === 'image/jpeg' || contentType === 'image/jpg') return 'jpg';
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'bin';
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const role = String(user.role || '').toLowerCase();
  const vendorId = String(user.vendorId || '').trim();
  if (role !== 'vendor' || !vendorId) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const expenseId = String(params.id || '').trim();
  if (!expenseId) {
    return NextResponse.json({ ok: false, error: 'Invalid expense id' }, { status: 400 });
  }

  const bid = await prisma.jobBid.findUnique({
    where: { expenseId_vendorId: { expenseId, vendorId } },
    select: { id: true, status: true, clientId: true },
  });
  if (!bid) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
  if (BLOCKED_BID_STATUSES.has(String(bid.status || '').toLowerCase())) {
    return NextResponse.json({ ok: false, error: 'Bid is not open for invoice upload' }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const raw = (body || {}) as Record<string, unknown>;
  const contentType = raw.contentType;
  const sizeBytes = raw.sizeBytes;

  if (
    typeof contentType !== 'string' ||
    !ALLOWED_CONTENT_TYPES.includes(contentType as (typeof ALLOWED_CONTENT_TYPES)[number])
  ) {
    return NextResponse.json(
      { ok: false, error: `contentType must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}` },
      { status: 400 },
    );
  }
  if (typeof sizeBytes !== 'number' || sizeBytes <= 0 || sizeBytes > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { ok: false, error: `sizeBytes must be between 1 and ${MAX_SIZE_BYTES} bytes` },
      { status: 400 },
    );
  }

  try {
    const ext = extensionForContentType(contentType);
    const clientPart = bid.clientId || 'no-client';
    const key = `job-bids/${clientPart}/${expenseId}/${vendorId}/${Date.now()}-${randomString(8)}.${ext}`;

    const uploadUrl = await generateUploadUrl(key, contentType, EXPIRES_IN_SECONDS);
    const publicUrl = publicUrlForKey(key);

    return NextResponse.json({
      ok: true,
      uploadUrl,
      publicUrl,
      key,
      expiresInSeconds: EXPIRES_IN_SECONDS,
    });
  } catch (err: unknown) {
    console.error('[POST /api/pm/expenses/:id/bids/invoice-presigned]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
