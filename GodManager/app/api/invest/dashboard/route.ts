import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resolveInvestClient, communityFromAddress } from '@/lib/investServer';
import { getUsdBrl } from '@/lib/fx';
import { isRentcastConfigured } from '@/lib/rentcast';
import { DEFAULT_ASSUMPTIONS } from '@/lib/investCalc';

export const dynamic = 'force-dynamic';

/**
 * GET /api/invest/dashboard?clientId=
 * Devolve, por casa: metadados (endereço, quartos, community), receita real do
 * período (owner recebido líquido = PropertyRentReceipt.netOwner), valor do imóvel
 * (+ fonte/data) — e as premissas + câmbio. Métricas são calculadas no client.
 */
export async function GET(req: Request) {
  const scope = await resolveInvestClient(new URL(req.url).searchParams.get('clientId'));
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
  const clientId = scope.clientId;

  try {
    const [properties, receipts, investments, settings] = await Promise.all([
      prisma.property.findMany({
        where: { clientId },
        select: { id: true, address: true, bedrooms: true },
      }),
      prisma.propertyRentReceipt.findMany({
        where: { clientId, propertyId: { not: null } },
        select: { propertyId: true, periodMonth: true, netOwner: true, grossReceived: true },
      }),
      prisma.propertyInvestment.findMany({ where: { clientId } }),
      prisma.investSettings.findUnique({ where: { clientId } }),
    ]);

    // Agrega receita por propriedade (owner recebido líquido) + meses com dados + série mensal.
    const agg = new Map<string, { owner: number; months: Set<string>; byMonth: Map<string, number> }>();
    for (const r of receipts) {
      if (!r.propertyId) continue;
      const cur = agg.get(r.propertyId) || { owner: 0, months: new Set<string>(), byMonth: new Map<string, number>() };
      const net = Number(r.netOwner) || 0;
      cur.owner += net;
      cur.months.add(r.periodMonth);
      cur.byMonth.set(r.periodMonth, (cur.byMonth.get(r.periodMonth) || 0) + net);
      agg.set(r.propertyId, cur);
    }
    const invById = new Map(investments.map((i) => [i.propertyId, i]));

    const houses = properties.map((p) => {
      const a = agg.get(p.id);
      const inv = invById.get(p.id);
      const monthly = a
        ? [...a.byMonth.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([month, v]) => ({ month, owner: Math.round(v * 100) / 100 }))
        : [];
      return {
        propertyId: p.id,
        address: p.address,
        community: communityFromAddress(p.address),
        bedrooms: p.bedrooms ?? null,
        // Fontes: reservas/payouts não existem no long-term (sem dado). owner = real.
        reservasTotal: 0,
        payoutsTotal: 0,
        ownerTotal: a ? Math.round(a.owner * 100) / 100 : 0,
        monthsWithData: a ? a.months.size : 0,
        monthly,
        value: inv ? Number(inv.value) : 0,
        valueSource: inv ? inv.valueSource : null,
        valueUpdatedAt: inv ? inv.valueUpdatedAt.toISOString() : null,
      };
    });

    const assumptions = settings
      ? {
          downPct: Number(settings.downPct),
          rate: Number(settings.rate),
          termYears: settings.termYears,
          opexPct: Number(settings.opexPct),
          revenueBasis: settings.revenueBasis as 'gross' | 'owner' | 'payouts',
        }
      : { ...DEFAULT_ASSUMPTIONS };

    const fx = await getUsdBrl({
      fxBrl: settings?.fxBrl != null ? Number(settings.fxBrl) : null,
      fxUpdatedAt: settings?.fxUpdatedAt ?? null,
    });
    // Persiste o último câmbio bom (best-effort).
    if (fx.rate && settings) {
      prisma.investSettings
        .update({ where: { clientId }, data: { fxBrl: fx.rate.toFixed(4), fxUpdatedAt: new Date() } })
        .catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      clientId,
      houses,
      assumptions,
      fx,
      rentcastConfigured: isRentcastConfigured(),
      dataNotes: {
        reservas: 'Sem fonte neste sistema (long-term não tem reservas/comissão de temporada).',
        payouts: 'Sem fonte por casa neste sistema.',
        owner: 'Owner recebido líquido (aluguel − mgmt fee). Aproximação: não deduz imposto/HOA/seguro do dono.',
      },
    });
  } catch (e) {
    console.error('[invest/dashboard]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}
