import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { toClientScopeUser, canAccessClientId } from '@/lib/clientScope';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

function canApprove(role: string): boolean {
  return ['super_admin', 'admin', 'manager'].includes(role);
}

/**
 * POST /api/manager-pro/owner-statement/approve
 *   { lineItemId }                  → aprova UM lançamento
 *   { propertyId, yearMonth }       → aprova TODOS os pendentes daquela casa/mês ("aprovar tudo")
 *   { lineItemId, undo: true }      → volta a "aguardando aprovação"
 * Aprovar = marca approvedAt/approvedBy (vira lançamento contábil da casa).
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  if (!canApprove(user.role)) return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });

  try {
    const body = (await req.json().catch(() => ({}))) as {
      lineItemId?: string;
      propertyId?: string;
      yearMonth?: string;
      undo?: boolean;
    };
    const lineItemId = String(body?.lineItemId || '').trim();
    const propertyId = String(body?.propertyId || '').trim();
    const yearMonth = String(body?.yearMonth || '').trim();
    const undo = !!body?.undo;
    const scopeUser = toClientScopeUser(user);
    const now = new Date();

    if (lineItemId) {
      const li = await prisma.statementLineItem.findUnique({
        where: { id: lineItemId },
        select: { id: true, clientId: true, ownerMonthPayout: { select: { clientId: true } } },
      });
      if (!li) return NextResponse.json({ ok: false, error: 'Lançamento não encontrado.' }, { status: 404 });
      const cid = li.clientId || li.ownerMonthPayout?.clientId || null;
      if (!cid || !canAccessClientId(scopeUser, cid)) {
        return NextResponse.json({ ok: false, error: 'Sem acesso.' }, { status: 403 });
      }
      await prisma.statementLineItem.update({
        where: { id: lineItemId },
        data: undo ? { approvedAt: null, approvedBy: null } : { approvedAt: now, approvedBy: user.id },
      });
      await recordAudit({
        request: req,
        actor: { id: user.id, email: user.email },
        action: undo ? 'statement_line.unapprove' : 'statement_line.approve',
        entity: 'statement_line_item',
        entityId: lineItemId,
        clientId: cid,
        details: '',
      });
      return NextResponse.json({ ok: true, approved: undo ? 0 : 1 });
    }

    if (propertyId && yearMonth) {
      const payout = await prisma.ownerMonthPayout.findUnique({
        where: { propertyId_yearMonth: { propertyId, yearMonth } },
        select: { id: true, clientId: true, property: { select: { clientId: true } } },
      });
      if (!payout) return NextResponse.json({ ok: false, error: 'Statement não encontrado.' }, { status: 404 });
      const cid = payout.clientId || payout.property?.clientId || null;
      if (!cid || !canAccessClientId(scopeUser, cid)) {
        return NextResponse.json({ ok: false, error: 'Sem acesso.' }, { status: 403 });
      }
      const r = await prisma.statementLineItem.updateMany({
        where: { ownerMonthPayoutId: payout.id, approvedAt: null },
        data: { approvedAt: now, approvedBy: user.id },
      });
      await recordAudit({
        request: req,
        actor: { id: user.id, email: user.email },
        action: 'statement_line.approve_all',
        entity: 'owner_month_payout',
        entityId: payout.id,
        clientId: cid,
        details: `approved:${r.count}`,
      });
      return NextResponse.json({ ok: true, approved: r.count });
    }

    return NextResponse.json({ ok: false, error: 'Informe lineItemId ou (propertyId + yearMonth).' }, { status: 400 });
  } catch (e) {
    console.error('[owner-statement/approve]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}
