/**
 * Câmbio USD→BRL via API pública grátis sem chave (open.er-api.com).
 * Cache em memória (~6h) + fallback para o último valor bom (passado do banco).
 */
let mem: { rate: number; at: number } | null = null;
const TTL_MS = 6 * 60 * 60 * 1000;

export interface FxResult {
  rate: number | null;
  source: string;
  at: string | null;
}

export async function getUsdBrl(dbFallback?: {
  fxBrl: number | null;
  fxUpdatedAt: Date | null;
}): Promise<FxResult> {
  const now = Date.now();
  if (mem && now - mem.at < TTL_MS) {
    return { rate: mem.rate, source: 'open.er-api.com (cache)', at: new Date(mem.at).toISOString() };
  }
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' });
    const j = (await r.json()) as { rates?: { BRL?: number } };
    const brl = j?.rates?.BRL;
    if (typeof brl === 'number' && brl > 0) {
      mem = { rate: brl, at: now };
      return { rate: brl, source: 'open.er-api.com', at: new Date(now).toISOString() };
    }
  } catch {
    /* usa fallback abaixo */
  }
  if (mem) return { rate: mem.rate, source: 'open.er-api.com (fallback)', at: new Date(mem.at).toISOString() };
  if (dbFallback?.fxBrl && dbFallback.fxBrl > 0) {
    return {
      rate: Number(dbFallback.fxBrl),
      source: 'último salvo',
      at: dbFallback.fxUpdatedAt ? dbFallback.fxUpdatedAt.toISOString() : null,
    };
  }
  return { rate: null, source: 'indisponível', at: null };
}
