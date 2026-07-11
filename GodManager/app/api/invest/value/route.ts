import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resolveInvestClient } from '@/lib/investServer';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

/** POST — salva/edita o valor MANUAL do imóvel (sempre vence sobre o Rentcast). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const scope = await resolveInvestClient(body.clientId != null ? String(body.clientId) : null);
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

  const propertyId = String(body.propertyId ?? '').trim();
  const value = Number(body.value);
  if (!propertyId) return NextResponse.json({ ok: false, error: 'propertyId requerido.' }, { status: 400 });
  if (!Number.isFinite(value) || value < 0) {
    return NextResponse.json({ ok: false, error: 'Valor inválido.' }, { status: 400 });
  }
  // valida propriedade do cliente
  const prop = await prisma.property.findFirst({
    where: { id: propertyId, clientId: scope.clientId },
    select: { id: true },
  });
  if (!prop) return NextResponse.json({ ok: false, error: 'Propriedade não encontrada.' }, { status: 404 });

  await prisma.propertyInvestment.upsert({
    where: { clientId_propertyId: { clientId: scope.clientId, propertyId } },
    create: {
      clientId: scope.clientId,
      propertyId,
      value: value.toFixed(2),
      valueSource: 'manual',
      valueUpdatedAt: new Date(),
    },
    update: { value: value.toFixed(2), valueSource: 'manual', valueUpdatedAt: new Date() },
  });

  await recordAudit({
    request: req,
    actor: { id: scope.user.id, email: scope.user.email },
    action: 'invest.value.set',
    entity: 'property_investment',
    entityId: propertyId,
    clientId: scope.clientId,
    details: `manual $${value.toFixed(2)}`,
  });
  return NextResponse.json({ ok: true });
}
