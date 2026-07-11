import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resolveInvestClient } from '@/lib/investServer';
import { rentcastAvm, isRentcastConfigured } from '@/lib/rentcast';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

/**
 * POST /api/invest/pull-values  { clientId?, maxCalls? }
 * Puxa o valor de mercado (Rentcast) priorizando MAIOR receita. Idempotente
 * (só puxa quem ainda NÃO tem valor — manual sempre vence), respeita maxCalls,
 * commita cada um (se parar no meio, o que veio fica salvo) e para no 429.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const scope = await resolveInvestClient(body.clientId != null ? String(body.clientId) : null);
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

  if (!isRentcastConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'RENTCAST_API_KEY não configurada. Defina a variável de ambiente para puxar valores de mercado.' },
      { status: 400 },
    );
  }

  const maxCalls = Math.max(1, Math.min(200, Math.round(Number(body.maxCalls) || 45)));
  const clientId = scope.clientId;

  // Receita por propriedade (para priorizar) + quem já tem valor (pular).
  const [properties, receipts, existing] = await Promise.all([
    prisma.property.findMany({ where: { clientId }, select: { id: true, address: true, bedrooms: true } }),
    prisma.propertyRentReceipt.findMany({
      where: { clientId, propertyId: { not: null } },
      select: { propertyId: true, netOwner: true },
    }),
    prisma.propertyInvestment.findMany({ where: { clientId }, select: { propertyId: true } }),
  ]);
  const haveValue = new Set(existing.map((e) => e.propertyId));
  const revByProp = new Map<string, number>();
  for (const r of receipts) {
    if (!r.propertyId) continue;
    revByProp.set(r.propertyId, (revByProp.get(r.propertyId) || 0) + (Number(r.netOwner) || 0));
  }

  const candidates = properties
    .filter((p) => !haveValue.has(p.id) && p.address)
    .sort((a, b) => (revByProp.get(b.id) || 0) - (revByProp.get(a.id) || 0));

  let pulled = 0;
  let calls = 0;
  let stoppedRateLimit = false;
  const failed: Array<{ address: string; error: string }> = [];

  for (const p of candidates) {
    if (calls >= maxCalls) break;
    calls++;
    const res = await rentcastAvm(p.address, p.bedrooms ?? undefined);
    if (res.status === 429) {
      stoppedRateLimit = true;
      break;
    }
    if (res.ok && res.price) {
      await prisma.propertyInvestment.upsert({
        where: { clientId_propertyId: { clientId, propertyId: p.id } },
        create: {
          clientId,
          propertyId: p.id,
          value: res.price.toFixed(2),
          valueSource: 'rentcast',
          valueUpdatedAt: new Date(),
        },
        // manual vence: só atualiza se ainda não for manual (não deveria chegar aqui pois filtramos haveValue)
        update: { value: res.price.toFixed(2), valueSource: 'rentcast', valueUpdatedAt: new Date() },
      });
      pulled++;
    } else {
      failed.push({ address: p.address, error: res.error || 'sem preço' });
    }
  }

  await recordAudit({
    request: req,
    actor: { id: scope.user.id, email: scope.user.email },
    action: 'invest.pull_values',
    entity: 'property_investment',
    entityId: clientId,
    clientId,
    details: `pulled ${pulled}/${calls} (max ${maxCalls})${stoppedRateLimit ? ' STOP 429' : ''}`,
  });

  return NextResponse.json({
    ok: true,
    pulled,
    calls,
    remaining: candidates.length - calls,
    stoppedRateLimit,
    failedCount: failed.length,
    failedSample: failed.slice(0, 5),
  });
}
