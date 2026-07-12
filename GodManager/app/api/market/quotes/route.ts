import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Ticker de mercado (fininho/sutil no topo do painel).
 * Busca cotações reais no endpoint público de chart do Yahoo (sem API key, sem crumb).
 * Cache em memória de 60s para não martelar a fonte a cada navegação.
 */

type Quote = {
  symbol: string;
  label: string;
  price: number | null;
  changePct: number | null;
};

// Índices/ativos relevantes p/ imobiliário + câmbio BRL. label curto = o que aparece na barra.
const SYMBOLS: Array<{ symbol: string; label: string }> = [
  { symbol: '^GSPC', label: 'S&P 500' },
  { symbol: '^IXIC', label: 'Nasdaq' },
  { symbol: '^DJI', label: 'Dow' },
  { symbol: '^TNX', label: 'US 10Y' },
  { symbol: 'BRL=X', label: 'USD/BRL' },
  { symbol: 'BTC-USD', label: 'BTC' },
];

let CACHE: { at: number; data: Quote[] } | null = null;
const TTL_MS = 60_000;

async function fetchOne(symbol: string, label: string): Promise<Quote> {
  try {
    const url =
      'https://query1.finance.yahoo.com/v8/finance/chart/' +
      encodeURIComponent(symbol) +
      '?range=1d&interval=1d';
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (GodManager ticker)' },
      cache: 'no-store',
      signal: AbortSignal.timeout(4500),
    });
    if (!r.ok) return { symbol, label, price: null, changePct: null };
    const j = (await r.json()) as any;
    const meta = j?.chart?.result?.[0]?.meta;
    const price =
      typeof meta?.regularMarketPrice === 'number' ? meta.regularMarketPrice : null;
    const prev =
      typeof meta?.chartPreviousClose === 'number'
        ? meta.chartPreviousClose
        : typeof meta?.previousClose === 'number'
          ? meta.previousClose
          : null;
    const changePct =
      price != null && prev != null && prev !== 0
        ? ((price - prev) / prev) * 100
        : null;
    return { symbol, label, price, changePct };
  } catch {
    return { symbol, label, price: null, changePct: null };
  }
}

export async function GET() {
  const now = Date.now();
  if (CACHE && now - CACHE.at < TTL_MS) {
    return NextResponse.json({ ok: true, cached: true, quotes: CACHE.data });
  }
  try {
    const quotes = await Promise.all(SYMBOLS.map((s) => fetchOne(s.symbol, s.label)));
    const anyReal = quotes.some((q) => q.price != null);
    if (anyReal) CACHE = { at: now, data: quotes };
    return NextResponse.json({ ok: true, cached: false, quotes });
  } catch (e) {
    if (CACHE) return NextResponse.json({ ok: true, cached: true, quotes: CACHE.data });
    return NextResponse.json({ ok: false, error: 'Falha ao buscar cotações.', quotes: [] }, { status: 200 });
  }
}
