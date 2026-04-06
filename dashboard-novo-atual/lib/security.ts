/**
 * Segurança – criptografia de dados sensíveis, tokens temporários e rate limiting.
 * Em produção: usar crypto.subtle (AES-GCM), JWT com exp, rate limit em Redis/API.
 */

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 min
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 min
const RATE_LIMIT_MAX = 30; // max requests per window per key

const tokenStore = new Map<string, { payload: string; expiresAt: number }>();
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Codifica dados sensíveis (demo: base64). Em produção usar AES-GCM via crypto.subtle.
 */
export function encryptSensitive(plain: string, _secret?: string): string {
  if (typeof btoa === 'undefined') return plain;
  try {
    return btoa(encodeURIComponent(plain));
  } catch {
    return plain;
  }
}

/**
 * Decodifica dados sensíveis. Em produção: decrypt com chave segura.
 */
export function decryptSensitive(cipher: string, _secret?: string): string {
  if (typeof atob === 'undefined') return cipher;
  try {
    return decodeURIComponent(atob(cipher));
  } catch {
    return cipher;
  }
}

/**
 * Gera token temporário (demo: id + exp). Em produção: JWT ou signed token.
 */
export function createTempToken(payload: Record<string, unknown>, ttlMs: number = TOKEN_TTL_MS): string {
  const id = `tok_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  const expiresAt = Date.now() + ttlMs;
  tokenStore.set(id, { payload: JSON.stringify(payload), expiresAt });
  return id;
}

/**
 * Valida token e retorna payload se válido. Remove se expirado.
 */
export function validateTempToken(token: string): Record<string, unknown> | null {
  const entry = tokenStore.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    tokenStore.delete(token);
    return null;
  }
  try {
    return JSON.parse(entry.payload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Rate limiting por chave (ex: userId ou IP). Retorna true se permitido, false se bloqueado.
 */
export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

/**
 * Retorna segundos restantes até o limite ser resetado (para UI).
 */
export function getRateLimitResetIn(key: string): number | null {
  const entry = rateLimitStore.get(key);
  if (!entry) return null;
  const remaining = Math.ceil((entry.resetAt - Date.now()) / 1000);
  return remaining > 0 ? remaining : null;
}
