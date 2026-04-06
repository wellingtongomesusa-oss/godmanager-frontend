/**
 * Rent Engine — precificação dinâmica (RENT_ENGINE_API_KEY).
 */

export type RentRecommendation = {
  unidadeId: string;
  endereco: string;
  precoAtual: number;
  precoRecomendado: number;
  confianca: number;
};

export type MarketDataPoint = {
  regiao: string;
  adrMedio: number;
  ocupacao: number;
};

export type AlignBadge = 'alinhado' | 'abaixo' | 'acima';

export function recommendationBadge(rec: RentRecommendation): AlignBadge {
  const d = rec.precoRecomendado - rec.precoAtual;
  const t = Math.abs(rec.precoRecomendado * 0.03);
  if (Math.abs(d) <= t) return 'alinhado';
  return d > 0 ? 'abaixo' : 'acima';
}

const DEMO: RentRecommendation[] = [
  { unidadeId: 'u-4512', endereco: '4512 Storey Lake', precoAtual: 4850, precoRecomendado: 4920, confianca: 0.82 },
  { unidadeId: 'u-8820', endereco: '8820 Champions Gate', precoAtual: 3600, precoRecomendado: 3450, confianca: 0.76 },
];

export async function getRecommendationsDemo(): Promise<RentRecommendation[]> {
  await new Promise((r) => setTimeout(r, 200));
  return DEMO;
}

export async function getMarketDataDemo(regiao: string): Promise<MarketDataPoint> {
  void regiao;
  await new Promise((r) => setTimeout(r, 150));
  return { regiao: regiao || 'Kissimmee FL', adrMedio: 285, ocupacao: 0.78 };
}

export async function applyPriceDemo(unidadeId: string, preco: number): Promise<{ ok: true }> {
  void unidadeId;
  void preco;
  await new Promise((r) => setTimeout(r, 220));
  return { ok: true };
}
