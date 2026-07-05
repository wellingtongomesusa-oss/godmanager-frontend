import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { canAccessClientId, toClientScopeUser } from '@/lib/clientScope';
import { isStaffUser } from '@/lib/supportTickets';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

/**
 * POST /api/support-tickets/:id/rating — avaliação 1-5 estrelas do chamado.
 * Quem avalia é o requester (dono do chamado); staff com acesso ao cliente também pode ajustar.
 * Body: { rating: 1..5 }
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const ticket = await prisma.supportTicket.findUnique({ where: { id: params.id } });
    if (!ticket) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

    const scopeUser = toClientScopeUser(user);
    const isRequester = ticket.requesterId === user.id;
    const isStaffScoped = isStaffUser(user) && canAccessClientId(scopeUser, ticket.clientId);
    if (!isRequester && !isStaffScoped) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const rating = Number((body as { rating?: unknown }).rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { ok: false, error: 'rating deve ser um inteiro de 1 a 5' },
        { status: 400 },
      );
    }

    const updated = await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { rating, ratedAt: new Date() },
      select: { id: true, rating: true, ratedAt: true },
    });

    await recordAudit({
      request: req,
      actor: { id: user.id, email: user.email },
      action: 'support_ticket.rate',
      entity: 'support_ticket',
      entityId: ticket.id,
      details: `rating: ${rating}`,
      clientId: ticket.clientId,
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      rating: updated.rating,
      ratedAt: updated.ratedAt ? updated.ratedAt.toISOString() : null,
    });
  } catch (e) {
    console.error('[POST /api/support-tickets/:id/rating]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
