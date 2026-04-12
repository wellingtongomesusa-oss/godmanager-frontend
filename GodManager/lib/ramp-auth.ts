const DEFAULT_API_BASE = 'https://api.ramp.com/developer/v1';

/** Scopes pedidos ao token (subconjunto do permitido na app Ramp). */
const TOKEN_SCOPE =
  'accounting:read cards:read transactions:read business:read users:read merchants:read';

type RampTokenJson = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
};

let _cachedToken: string | null = null;
let _tokenExpiresAt = 0;

/** Base URL without trailing slash, e.g. `https://api.ramp.com/developer/v1`. */
export function getRampApiBase(): string {
  const raw = (process.env.RAMP_API_BASE_URL || DEFAULT_API_BASE).trim();
  return raw.replace(/\/$/, '');
}

/**
 * OAuth 2.0 client credentials (Ramp Developer API).
 * Documentação OpenAPI: `Authorization: Basic` base64(client_id:client_secret) e body
 * `application/x-www-form-urlencoded` com `grant_type=client_credentials` e `scope`.
 */
export async function getRampToken(): Promise<string> {
  const clientId = process.env.RAMP_CLIENT_ID;
  const clientSecret = process.env.RAMP_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('RAMP_CLIENT_ID ou RAMP_CLIENT_SECRET nao definidos no .env.local');
  }

  const now = Date.now();
  if (_cachedToken && now < _tokenExpiresAt) {
    return _cachedToken;
  }

  const baseUrl = getRampApiBase();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: TOKEN_SCOPE,
  }).toString();

  const res = await fetch(`${baseUrl}/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Ramp token request failed: ${res.status} — ${errText}`);
  }

  const data = (await res.json()) as RampTokenJson;

  if (!data.access_token) {
    throw new Error(`Ramp token response sem access_token: ${JSON.stringify(data)}`);
  }

  _cachedToken = data.access_token;
  const expiresIn =
    typeof data.expires_in === 'number' && Number.isFinite(data.expires_in)
      ? data.expires_in
      : 3600;
  const ttlSec = Math.max(30, expiresIn - 60);
  _tokenExpiresAt = now + ttlSec * 1000;
  return _cachedToken;
}
