import { prisma } from '@/lib/db';

/**
 * KPIs reais do dashboard para a SophIA responder dinamicamente
 * (quantas casas, ocupação, aluguéis recebidos, etc.). SEM valores fixos —
 * sempre calculados do banco, escopados ao cliente.
 *
 * Obs: ManagerProp é long-term. "Reservas/check-in/check-out" não existem como
 * short-term; os análogos são leases/inquilinos ativos (move-in/out).
 */
export interface SophiaKpis {
  propertyCount: number;
  activeTenants: number;
  occupiedProperties: number;
  vacantProperties: number;
  occupancyPct: number;
  latestRentMonth: string | null;
  rentReceivedLatest: number;
  netOwnerLatest: number;
}

export async function computeKpis(clientId: string | null): Promise<SophiaKpis> {
  const scope = clientId ? { clientId } : {};
  const [propertyCount, activeTenants, occupiedProperties] = await Promise.all([
    prisma.property.count({ where: scope }),
    prisma.tenant.count({ where: { ...scope, status: 'active' } }),
    prisma.property.count({ where: { ...scope, tenants: { some: { status: 'active' } } } }),
  ]);
  const vacantProperties = Math.max(0, propertyCount - occupiedProperties);
  const occupancyPct = propertyCount ? Math.round((occupiedProperties / propertyCount) * 1000) / 10 : 0;

  let latestRentMonth: string | null = null;
  let rentReceivedLatest = 0;
  let netOwnerLatest = 0;
  if (clientId) {
    const latest = await prisma.propertyRentReceipt.findFirst({
      where: { clientId },
      orderBy: { periodMonth: 'desc' },
      select: { periodMonth: true },
    });
    if (latest) {
      latestRentMonth = latest.periodMonth;
      const agg = await prisma.propertyRentReceipt.aggregate({
        where: { clientId, periodMonth: latest.periodMonth },
        _sum: { grossReceived: true, netOwner: true },
      });
      rentReceivedLatest = Number(agg._sum.grossReceived || 0);
      netOwnerLatest = Number(agg._sum.netOwner || 0);
    }
  }

  return {
    propertyCount,
    activeTenants,
    occupiedProperties,
    vacantProperties,
    occupancyPct,
    latestRentMonth,
    rentReceivedLatest,
    netOwnerLatest,
  };
}

/** Formata os KPIs como bloco de texto para injetar no system prompt da SophIA. */
export function kpisToPromptBlock(k: SophiaKpis): string {
  const money = (n: number) =>
    '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const lines = [
    'DADOS AO VIVO (reais, agora — use estes números; nunca invente):',
    `- Total de propriedades cadastradas: ${k.propertyCount}`,
    `- Inquilinos ativos: ${k.activeTenants}`,
    `- Propriedades ocupadas: ${k.occupiedProperties} · vagas: ${k.vacantProperties}`,
    `- Ocupação: ${k.occupancyPct}%`,
  ];
  if (k.latestRentMonth) {
    lines.push(
      `- Aluguéis recebidos (${k.latestRentMonth}): ${money(k.rentReceivedLatest)} bruto · ${money(k.netOwnerLatest)} líquido (após mgmt fee)`,
    );
  }
  return lines.join('\n');
}
