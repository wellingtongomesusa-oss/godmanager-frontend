/**
 * AVM (valor de mercado) por endereço — provider plugável, padrão Rentcast.
 * GET https://api.rentcast.io/v1/avm/value?address=<addr>&bedrooms=<n>
 * header X-Api-Key: RENTCAST_API_KEY (free tier ~50/mês). Resposta: campo `price`.
 */
export interface AvmResult {
  ok: boolean;
  price?: number;
  status?: number;
  error?: string; // 'no_key' | 'rate_limit' | 'no_price' | 'http_XXX' | 'fetch_failed'
}

export function isRentcastConfigured(): boolean {
  return !!process.env.RENTCAST_API_KEY;
}

export async function rentcastAvm(address: string, bedrooms?: number | null): Promise<AvmResult> {
  const key = process.env.RENTCAST_API_KEY;
  if (!key) return { ok: false, error: 'no_key' };
  const addr = String(address || '').trim();
  if (!addr) return { ok: false, error: 'no_address' };

  const params = new URLSearchParams({ address: addr });
  if (bedrooms && bedrooms > 0) params.set('bedrooms', String(bedrooms));

  try {
    const r = await fetch('https://api.rentcast.io/v1/avm/value?' + params.toString(), {
      headers: { 'X-Api-Key': key, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (r.status === 429) return { ok: false, status: 429, error: 'rate_limit' };
    if (!r.ok) return { ok: false, status: r.status, error: 'http_' + r.status };
    const j = (await r.json()) as { price?: number };
    const price = j?.price;
    if (typeof price === 'number' && price > 0) return { ok: true, price };
    return { ok: false, error: 'no_price' };
  } catch {
    return { ok: false, error: 'fetch_failed' };
  }
}
