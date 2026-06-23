import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { canAccessClientId, toClientScopeUser } from '@/lib/clientScope';
import { recordAudit } from '@/lib/auditServer';
import { isStaffUser, supportTicketUserDisplayName } from '@/lib/supportTickets';

export const dynamic = 'force-dynamic';

function serializeMessage(message: {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string | null;
  authorRole: string | null;
  authorClientId: string | null;
  body: string;
  attachments: unknown;
  isStaff: boolean;
  clientId: string | null;
  createdAt: Date;
}) {
  return {
    id: message.id,
    ticketId: message.ticketId,
    authorId: message.authorId,
    authorName: message.authorName,
    authorRole: message.authorRole,
    authorClientId: message.authorClientId,
    body: message.body,
    attachments: message.attachments,
    isStaff: message.isStaff,
    clientId: message.clientId,
    createdAt: message.createdAt.toISOString(),
  };
}

function canReplyToTicket(
  user: { id: string; role: string },
  ticket: { clientId: string | null; requesterId: string },
  scopeUser: ReturnType<typeof toClientScopeUser>
): boolean {
  if (ticket.requesterId === user.id) return true;
  if (isStaffUser(user) && canAccessClientId(scopeUser, ticket.clientId)) return true;
  return false;
}

/** POST /api/support-tickets/:id/messages — reply to ticket */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const ticket = await prisma.supportTicket.findUnique({ where: { id: params.id } });
    if (!ticket) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    }

    const scopeUser = toClientScopeUser(user);
    if (!canReplyToTicket(user, ticket, scopeUser)) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const messageBody = body.body;
    const attachments = body.attachments;

    if (messageBody == null || String(messageBody).trim() === '') {
      return NextResponse.json({ ok: false, error: 'body required' }, { status: 400 });
    }

    const trimmedBody = String(messageBody).trim();
    const staff = isStaffUser(user);
    const authorName = supportTicketUserDisplayName(user);
    const now = new Date();

    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.supportTicketMessage.create({
        data: {
          ticketId: ticket.id,
          authorId: user.id,
          authorName,
          authorRole: user.role,
          body: trimmedBody,
          attachments:
            attachments === undefined
              ? undefined
              : attachments === null
                ? Prisma.JsonNull
                : (attachments as Prisma.InputJsonValue),
          isStaff: staff,
          authorClientId: user.clientId ?? null,
          clientId: ticket.clientId,
        },
      });

      const ticketUpdate: { lastMessageAt: Date; status?: string } = { lastMessageAt: now };
      if (staff && ticket.status === 'open') {
        ticketUpdate.status = 'answered';
      } else if (!staff) {
        ticketUpdate.status = 'open';
      }

      await tx.supportTicket.update({
        where: { id: ticket.id },
        data: ticketUpdate,
      });

      return created;
    });

    await recordAudit({
      request: req,
      actor: { id: user.id, email: user.email },
      action: 'ticket.reply',
      entity: 'support_ticket',
      entityId: ticket.id,
      clientId: ticket.clientId,
      details: JSON.stringify({
        messageId: message.id,
        isStaff: staff,
        len: trimmedBody.length,
      }),
    });

    return NextResponse.json({ ok: true, message: serializeMessage(message) });
  } catch (e) {
    console.error('[POST /api/support-tickets/:id/messages]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
