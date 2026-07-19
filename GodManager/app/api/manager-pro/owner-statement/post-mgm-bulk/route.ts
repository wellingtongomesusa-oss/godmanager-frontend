import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import {
  toClientScopeUser,
  getClientScopeWhere,
  canAccessClientId,
} from '@/lib/clientScope';
import { normalizeYearMonthForWrite } from '@/lib/pmMonthRef';
import { isPayoutClosed } from '@/lib/statementWriteGuard';
import { recomputeOwnerMonthPayoutTotals } from '@/lib/ownerStatementTotals';

export const dynamic = 'force-dynamic';

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function canApprove(role: string): boolean {
  return ['super_admin', 'admin', 'manager'].includes(String(role || ''));
}

/** Normaliza a taxa de gestao da casa: aceita 0..30; fora disso ou invalida vira 0 (nao lança). */
function normPct(v: Prisma.Decimal | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const m = Number(v);
  if (!Number.isFinite(m) || m < 0 || m > 30) return 0;
  return m;
}

/**
 * POST /api/manager-pro/owner-statement/post-mgm-bulk  { yearMonth, clientId? }
 * Lança em massa a taxa de gestao (MGM) do mes como debito no statement de cada casa do escopo,
 * na taxa de cada casa (mgmtFeePct sobre o aluguel do contrato). Idempotente por mes
 * (source=MANUAL, sourceRefId="mgmt-fee:<YYYY-MM>") — nunca duplica. Pula statements fechados.
 */
export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Nao autenticado.' }, { status: 401 });
  if (!canApprove(user.role)) return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });

  try {
    const scopeUser = toClientScopeUser(user);
    const body = (await req.json().catch(() => ({}))) as { yearMonth?: string; clientId?: string; undo?: boolean };
    const ym = normalizeYearMonthForWrite(String(body?.yearMonth || '').trim());
    if (!ym || !YEAR_MONTH.test(ym)) {
      return NextResponse.json({ ok: false, error: 'yearMonth invalido.' }, { status: 400 });
    }
    const clientIdParam = String(body?.clientId || '').trim();

    const propWhere: Record<string, unknown> = { ...getClientScopeWhere(scopeUser) };
    if (clientIdParam) {
      if (!canAccessClientId(scopeUser, clientIdParam)) {
        return NextResponse.json({ ok: false, error: 'Sem acesso a esta empresa.' }, { status: 403 });
      }
      propWhere.clientId = clientIdParam;
    }

    const sourceRefId = `mgmt-fee:${ym}`;

    // DESFAZER: remove somente as linhas de MGM que ESTE botao lançou (source=MANUAL,
    // sourceRefId=mgmt-fee:<mes>), no escopo, pulando statements fechados. Nao toca em MGM de
    // outra origem (CSV/manual) nem em qualquer outro lançamento.
    if (body?.undo === true) {
      const lines = await prisma.statementLineItem.findMany({
        where: {
          source: 'MANUAL',
          sourceRefId,
          ownerMonthPayout: { yearMonth: ym, closedAt: null, property: propWhere },
        },
        select: { id: true, ownerMonthPayoutId: true },
      });
      const payoutIds = Array.from(new Set(lines.map((l) => l.ownerMonthPayoutId)));
      let removed = 0;
      if (lines.length) {
        await prisma.statementLineItem.deleteMany({ where: { id: { in: lines.map((l) => l.id) } } });
        removed = lines.length;
        for (const pid of payoutIds) {
          await recomputeOwnerMonthPayoutTotals(pid, prisma);
        }
        await prisma.auditEntry.create({
          data: {
            actorId: user.id,
            actorEmail: user.email ?? null,
            action: 'owner_statement.mgm_bulk.undo',
            entity: 'owner_month_payout',
            entityId: ym,
            clientId: clientIdParam || scopeUser.clientId || null,
            details: JSON.stringify({ yearMonth: ym, removed, payouts: payoutIds.length }),
          },
        });
      }
      return NextResponse.json({ ok: true, yearMonth: ym, undo: true, summary: { removed, payouts: payoutIds.length } });
    }

    const properties = await prisma.property.findMany({
      where: propWhere,
      select: { id: true, code: true, rent: true, mgmtFeePct: true, clientId: true },
      orderBy: { code: 'asc' },
    });

    let posted = 0, duplicated = 0, closed = 0, noFee = 0, failed = 0;

    for (const p of properties) {
      const rent = Number(p.rent) || 0;
      const pct = normPct(p.mgmtFeePct);
      const fee = Math.round(rent * (pct / 100) * 100) / 100;
      if (!(rent > 0) || !(pct > 0) || !(fee > 0)) { noFee++; continue; }

      const cid = p.clientId ?? scopeUser.clientId ?? null;
      if (!cid) { failed++; continue; }

      try {
        const existing = await prisma.ownerMonthPayout.findUnique({
          where: { propertyId_yearMonth: { propertyId: p.id, yearMonth: ym } },
          select: { id: true, closedAt: true },
        });
        if (isPayoutClosed(existing)) { closed++; continue; }

        // Garantia anti-duplicidade ampla: se a casa ja tem QUALQUER linha de taxa de gestao
        // neste mes (de qualquer origem — este botao, CSV "Management Fees", ou lançamento
        // manual), NAO lança outra. Evita cobrar MGM em dobro.
        if (existing) {
          const priorMgm = await prisma.statementLineItem.findFirst({
            where: {
              ownerMonthPayoutId: existing.id,
              OR: [
                { source: 'MANUAL', sourceRefId },
                { description: { contains: 'Management Fee', mode: 'insensitive' } },
                { description: { contains: 'Taxa de gest', mode: 'insensitive' } },
                { description: { contains: 'MGM', mode: 'insensitive' } },
              ],
            },
            select: { id: true },
          });
          if (priorMgm) { duplicated++; continue; }
        }

        const pid = existing
          ? existing.id
          : (await prisma.ownerMonthPayout.create({
              data: {
                propertyId: p.id, yearMonth: ym, clientId: cid,
                totalIncome: new Prisma.Decimal(0), totalExpenses: new Prisma.Decimal(0), netPayout: new Prisma.Decimal(0),
              }, select: { id: true },
            })).id;

        await prisma.$transaction(async (tx) => {
          await tx.statementLineItem.create({
            data: {
              ownerMonthPayoutId: pid, lineType: 'expense',
              description: `Taxa de gestao MGM (${pct}%)`,
              amount: new Prisma.Decimal(fee), sortOrder: 20, clientId: cid,
              source: 'MANUAL', sourceRefId,
              transactionDate: new Date(`${ym}-01T12:00:00.000Z`),
              approvedAt: new Date(), approvedBy: user.id,
            },
          });
          await recomputeOwnerMonthPayoutTotals(pid, tx);
        });
        posted++;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') { duplicated++; }
        else { failed++; }
      }
    }

    return NextResponse.json({
      ok: true, yearMonth: ym,
      summary: { posted, duplicated, closed, noFee, failed, total: properties.length },
    });
  } catch (e) {
    console.error('[POST /api/manager-pro/owner-statement/post-mgm-bulk]', e);
    return NextResponse.json({ ok: false, error: 'Falha ao lançar MGM em massa.' }, { status: 500 });
  }
}
