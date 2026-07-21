import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { normalizePropertyKey } from '@/lib/generalLedger';
import { csrfGuard } from '@/lib/csrfGuard';
import { rateLimitGuard } from '@/lib/apiRateLimit';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

/**
 * POST /api/rent-receipts/confirm  { propertyId?, propertyLabel, periodMonth, amount?, confirmed? }
 * Sinaliza que o aluguel foi RECEBIDO (ou desfaz). Upsert por (clientId, propertyKey, periodMonth).
 */
export async function POST(req: Request) {
  const bad = csrfGuard(req);
  if (bad) return bad;
  const rl = rateLimitGuard(req, { bucket: 'rent-receipts', max: 120 });
  if (rl) return rl;
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const scope = await resolveBankAccountClientScope(user, body.clientId ? String(body.clientId) : null);
    if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
    const clientId = scope.clientId;
    const periodMonth = String(body.periodMonth || '');
    if (!/^\d{4}-\d{2}$/.test(periodMonth)) return NextResponse.json({ ok: false, error: 'periodMonth inválido (YYYY-MM).' }, { status: 400 });

    let propertyId = body.propertyId ? String(body.propertyId) : null;
    let propertyLabel = String(body.propertyLabel || '').trim();
    if (propertyId) {
      const p = await prisma.property.findFirst({ where: { id: propertyId, clientId }, select: { id: true, address: true } });
      if (!p) return NextResponse.json({ ok: false, error: 'Imóvel não encontrado.' }, { status: 404 });
      if (!propertyLabel) propertyLabel = p.address || '';
    } else {
      propertyId = null;
    }
    if (!propertyLabel) return NextResponse.json({ ok: false, error: 'Imóvel é obrigatório.' }, { status: 400 });

    const propertyKey = normalizePropertyKey(propertyLabel);
    const confirmed = body.confirmed === false ? false : true;
    const amount =
      body.amount === undefined || body.amount === null || body.amount === ''
        ? null
        : new Prisma.Decimal(Number(body.amount) || 0);

    const saved = await prisma.rentReceiptConfirmation.upsert({
      where: { clientId_propertyKey_periodMonth: { clientId, propertyKey, periodMonth } },
      create: {
        clientId, propertyId, propertyKey, propertyLabel: propertyLabel.slice(0, 200), periodMonth,
        receivedConfirmed: confirmed, receivedAt: confirmed ? new Date() : null, amount,
        source: 'manual', confirmedByUserId: user.id,
      },
      update: {
        propertyId: propertyId ?? undefined,
        receivedConfirmed: confirmed,
        receivedAt: confirmed ? new Date() : null,
        amount: amount ?? undefined,
        confirmedByUserId: user.id,
      },
      select: { id: true },
    });

    await recordAudit({
      request: req, actor: { id: user.id, email: user.email },
      action: 'rent_receipt.confirm', entity: 'rent_receipt_confirmation', entityId: saved.id, clientId,
      details: `${propertyLabel} · ${periodMonth} · ${confirmed ? 'recebido' : 'desfeito'}`,
    });

    return NextResponse.json({ ok: true, id: saved.id, confirmed });
  } catch (e) {
    console.error('[POST /api/rent-receipts/confirm]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Falha ao confirmar recebimento.' }, { status: 500 });
  }
}
