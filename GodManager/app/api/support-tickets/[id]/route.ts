import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { canAccessClientId, toClientScopeUser } from '@/lib/clientScope';
import { recordAudit } from '@/lib/auditServer';
import { isAllowedTicketStatus, isStaffUser } from '@/lib/supportTickets';

export const dynamic = 'force-dynamic';

function serializeTicket(ticket: {
  id: string;
  code: string;
  subject: string;
  category: string | null;
  status: string;
  priority: string | null;
  requesterId: string;
  requesterName: string | null;
  requesterRole: string | null;
  requesterEmail: string | null;
  assignedToId: string | null;
  propertyId: string | null;
  clientId: string | null;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
}) {
  return {
    ...ticket,
    lastMessageAt: ticket.lastMessageAt.toISOString(),
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    closedAt: ticket.closedAt ? ticket.closedAt.toISOString() : null,
  };
}

function serializeMessage(message: {
  id: string;
  authorId: string;
  authorName: string | null;
  authorRole: string | null;
  authorClientId: string | null;
  body: string;
  attachments: unknown;
  isStaff: boolean;
  createdAt: Date;
}) {
  return {
    id: message.id,
    authorId: message.authorId,
    authorName: message.authorName,
    authorRole: message.authorRole,
    authorClientId: message.authorClientId,
    body: message.body,
    attachments: message.attachments,
    isStaff: message.isStaff,
    createdAt: message.createdAt.toISOString(),
  };
}

function canAccessTicket(
  user: { id: string; role: string },
  ticket: { clientId: string | null; requesterId: string },
  scopeUser: ReturnType<typeof toClientScopeUser>
): boolean {
  if (ticket.requesterId === user.id) return true;
  if (isStaffUser(user) && canAccessClientId(scopeUser, ticket.clientId)) return true;
  return false;
}

/** GET /api/support-tickets/:id — ticket detail + messages */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: params.id },
    });

    if (!ticket) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    }

    const scopeUser = toClientScopeUser(user);
    if (!canAccessTicket(user, ticket, scopeUser)) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const messages = await prisma.supportTicketMessage.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        authorId: true,
        authorName: true,
        authorRole: true,
        authorClientId: true,
        body: true,
        attachments: true,
        isStaff: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      ticket: serializeTicket(ticket),
      messages: messages.map(serializeMessage),
    });
  } catch (e) {
    console.error('[GET /api/support-tickets/:id]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}

/** PATCH /api/support-tickets/:id — staff updates status / assignee / priority */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!isStaffUser(user)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  try {
    const existing = await prisma.supportTicket.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    }

    const scopeUser = toClientScopeUser(user);
    if (!canAccessClientId(scopeUser, existing.clientId)) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const data: {
      status?: string;
      assignedToId?: string | null;
      priority?: string | null;
      closedAt?: Date | null;
    } = {};

    if (body.status !== undefined) {
      const nextStatus = String(body.status).trim();
      if (!isAllowedTicketStatus(nextStatus)) {
        return NextResponse.json({ ok: false, error: 'invalid_status' }, { status: 400 });
      }
      data.status = nextStatus;
      if (nextStatus === 'closed') {
        data.closedAt = new Date();
      } else if (existing.closedAt) {
        data.closedAt = null;
      }
    }

    if (body.assignedToId !== undefined) {
      const raw = body.assignedToId;
      data.assignedToId =
        raw == null || String(raw).trim() === '' ? null : String(raw).trim();
    }

    if (body.priority !== undefined) {
      const raw = body.priority;
      data.priority = raw == null || String(raw).trim() === '' ? null : String(raw).trim();
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: true, ticket: serializeTicket(existing) });
    }

    const updated = await prisma.supportTicket.update({
      where: { id: params.id },
      data,
    });

    await recordAudit({
      request: req,
      actor: { id: user.id, email: user.email },
      action: 'ticket.status',
      entity: 'support_ticket',
      entityId: updated.id,
      clientId: existing.clientId,
      details: JSON.stringify({
        old: {
          status: existing.status,
          assignedToId: existing.assignedToId,
          priority: existing.priority,
        },
        new: {
          status: updated.status,
          assignedToId: updated.assignedToId,
          priority: updated.priority,
        },
      }),
    });

    return NextResponse.json({ ok: true, ticket: serializeTicket(updated) });
  } catch (e) {
    console.error('[PATCH /api/support-tickets/:id]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
