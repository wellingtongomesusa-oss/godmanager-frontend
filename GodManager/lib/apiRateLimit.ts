import { NextResponse } from 'next/server';

/**
 * Rate limiting genérico por IP+rota (janela fixa) para endpoints sensíveis (#43).
 *
 * Objetivo: conter brute-force / scraping / abuso automatizado de rotas financeiras
 * (imports, geração de link-token do Plaid, transferências, reconciliação). NÃO é para
 * estrangular uso legítimo — os limites default são generosos (um humano não dispara 40
 * imports/min). Em memória por instância (suficiente como 1ª barreira; o WAF de borda do
 * #50 cobre o resto). Complementa o rate limit de login já existente (lib/rateLimit.ts).
 *
 * Uso:
 *   const rl = rateLimitGuard(req, { bucket: 'gl-import', max: 20 });
 *   if (rl) return rl;
 */
type Rec = { count: number; windowStart: number };

const buckets = new Map<string, Rec>();
const MAX_KEYS = 50_000; // trava contra crescimento ilimitado do Map

function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

export interface RateLimitOpts {
  /** Grupo lógico do limite (default: pathname da URL). Rotas que compartilham bucket somam contagem. */
  bucket?: string;
  /** Máximo de requisições por janela (default 40). */
  max?: number;
  /** Tamanho da janela em ms (default 60s). */
  windowMs?: number;
}

/** Retorna 429 (com Retry-After) se estourar o limite; caso contrário null. */
export function rateLimitGuard(req: Request, opts: RateLimitOpts = {}): NextResponse | null {
  const windowMs = opts.windowMs ?? 60_000;
  const max = opts.max ?? 40;
  let bucket = opts.bucket;
  if (!bucket) {
    try {
      bucket = new URL(req.url).pathname;
    } catch {
      bucket = 'api';
    }
  }
  const key = `${bucket}|${clientIp(req)}`;
  const now = Date.now();

  let rec = buckets.get(key);
  if (!rec || now - rec.windowStart >= windowMs) {
    rec = { count: 0, windowStart: now };
    buckets.set(key, rec);
  }
  rec.count += 1;

  // Limpeza oportunista de janelas expiradas quando o Map cresce demais.
  if (buckets.size > MAX_KEYS) {
    for (const [k, v] of buckets) {
      if (now - v.windowStart >= windowMs) buckets.delete(k);
    }
  }

  if (rec.count > max) {
    const retryAfter = Math.max(1, Math.ceil((rec.windowStart + windowMs - now) / 1000));
    const res = NextResponse.json(
      { ok: false, error: 'Muitas requisições em pouco tempo. Aguarde alguns segundos e tente de novo.' },
      { status: 429 },
    );
    res.headers.set('Retry-After', String(retryAfter));
    return res;
  }
  return null;
}
