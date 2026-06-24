import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';
import { isStaffUser } from '@/lib/supportTickets';

export const dynamic = 'force-dynamic';

const TICKETS_SAMPLE_LIMIT = 500;

function roundHours1(value: number): number {
  return Math.round(value * 10) / 10;
}

function isAwaitingStaffResponse(last: { isStaff: boolean; authorClientId: string | null } | undefined): boolean {
  if (!last) return true;
  const godManagerTeam = last.isStaff && last.authorClientId == null;
  return !godManagerTeam;
}

/** GET /api/support-tickets/stats — scoped ticket counters + average first staff response time */
export async function GET() {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const scopeUser = toClientScopeUser(user);
    const baseWhere: Prisma.SupportTicketWhereInput = {
      ...getClientScopeWhere(scopeUser),
      ...(isStaffUser(user) ? {} : { requesterId: user.id }),
    };

    const [abertos, emAndamento, respondidos, resolvidos, pendentes, total, tickets, activeTickets] =
      await Promise.all([
      prisma.supportTicket.count({ where: { ...baseWhere, status: 'open' } }),
      prisma.supportTicket.count({ where: { ...baseWhere, status: 'in_progress' } }),
      prisma.supportTicket.count({ where: { ...baseWhere, status: 'answered' } }),
      prisma.supportTicket.count({
        where: { ...baseWhere, status: { in: ['resolved', 'closed'] } },
      }),
      prisma.supportTicket.count({
        where: { ...baseWhere, status: { in: ['open', 'in_progress'] } },
      }),
      prisma.supportTicket.count({ where: baseWhere }),
      prisma.supportTicket.findMany({
        where: baseWhere,
        orderBy: { createdAt: 'desc' },
        take: TICKETS_SAMPLE_LIMIT,
        select: {
          createdAt: true,
          messages: {
            where: { isStaff: true },
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { createdAt: true },
          },
        },
      }),
      prisma.supportTicket.findMany({
        where: {
          ...baseWhere,
          status: { in: ['open', 'in_progress', 'answered'] },
        },
        select: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { isStaff: true, authorClientId: true },
          },
        },
      }),
    ]);

    let aguardandoResposta = 0;
    for (const ticket of activeTickets) {
      if (isAwaitingStaffResponse(ticket.messages[0])) {
        aguardandoResposta += 1;
      }
    }

    let tempoMedioRespostaHoras: number | null = null;
    let respondedCount = 0;
    let sumHours = 0;

    for (const ticket of tickets) {
      const firstStaffMsg = ticket.messages[0];
      if (!firstStaffMsg) continue;
      const deltaMs = firstStaffMsg.createdAt.getTime() - ticket.createdAt.getTime();
      sumHours += deltaMs / (1000 * 60 * 60);
      respondedCount += 1;
    }

    if (respondedCount > 0) {
      tempoMedioRespostaHoras = roundHours1(sumHours / respondedCount);
    }

    return NextResponse.json({
      ok: true,
      stats: {
        abertos,
        emAndamento,
        respondidos,
        resolvidos,
        pendentes,
        total,
        tempoMedioRespostaHoras,
        aguardandoResposta,
      },
    });
  } catch (e) {
    console.error('[GET /api/support-tickets/stats]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
