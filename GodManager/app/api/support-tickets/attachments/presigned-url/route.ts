import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { canAccessClientId, toClientScopeUser } from '@/lib/clientScope';
import { generateUploadUrl, publicUrlForKey } from '@/lib/r2';
import { isStaffUser } from '@/lib/supportTickets';

export const dynamic = 'force-dynamic';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const EXPIRES_IN_SECONDS = 300;

function canAccessTicketForAttachment(
  user: { id: string; role: string },
  ticket: { clientId: string | null; requesterId: string },
  scopeUser: ReturnType<typeof toClientScopeUser>
): boolean {
  if (ticket.requesterId === user.id) return true;
  if (isStaffUser(user) && canAccessClientId(scopeUser, ticket.clientId)) return true;
  return false;
}

function extForContentType(contentType: string): string {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
}

/** POST /api/support-tickets/attachments/presigned-url — presigned upload for ticket print attachments */
export async function POST(req: NextRequest) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const ticketId = body.ticketId;
    const contentType = body.contentType;
    const sizeBytes = body.sizeBytes;

    if (ticketId == null || String(ticketId).trim() === '') {
      return NextResponse.json({ ok: false, error: 'ticketId required' }, { status: 400 });
    }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: String(ticketId).trim() },
      select: { id: true, clientId: true, requesterId: true },
    });

    if (!ticket) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    }

    const scopeUser = toClientScopeUser(user);
    if (!canAccessTicketForAttachment(user, ticket, scopeUser)) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const ct = String(contentType || '').trim().toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.includes(ct)) {
      return NextResponse.json({ ok: false, error: 'invalid contentType' }, { status: 400 });
    }

    const size = typeof sizeBytes === 'number' ? sizeBytes : Number(sizeBytes);
    if (!Number.isFinite(size) || size < 1 || size > MAX_SIZE_BYTES) {
      return NextResponse.json({ ok: false, error: 'invalid sizeBytes' }, { status: 400 });
    }

    const safeTicketId = ticket.id.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeTicketId) {
      return NextResponse.json({ ok: false, error: 'invalid ticketId' }, { status: 400 });
    }

    const ext = extForContentType(ct);
    const random = randomBytes(6).toString('hex');
    const key = `support-tickets/${safeTicketId}/${Date.now()}-${random}.${ext}`;

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
    console.error('[POST /api/support-tickets/attachments/presigned-url]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
