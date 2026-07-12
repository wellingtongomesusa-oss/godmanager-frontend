import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { encryptField, decryptField } from '@/lib/encryption';

/**
 * QuickBooks Online — OAuth2 (Intuit) de produção.
 * Tokens ficam criptografados em ClientIntegration (provider QUICKBOOKS).
 * Refresh automático quando o access token expira.
 */

const AUTHORIZE_URL = 'https://appcenter.intuit.com/connect/oauth2';
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';
const SCOPE = 'com.intuit.quickbooks.accounting';

export type QbConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: string;
  apiBaseUrl: string;
  isConfigured: boolean;
};

export function qbConfig(): QbConfig {
  const clientId = process.env.QB_CLIENT_ID || '';
  const clientSecret = process.env.QB_CLIENT_SECRET || '';
  const redirectUri = process.env.QB_REDIRECT_URI || '';
  const environment = (process.env.QB_ENVIRONMENT || 'sandbox').toLowerCase();
  const apiBaseUrl =
    process.env.QB_BASE_URL ||
    (environment === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com');
  return {
    clientId,
    clientSecret,
    redirectUri,
    environment,
    apiBaseUrl,
    isConfigured: Boolean(clientId && clientSecret && redirectUri),
  };
}

function stateSecret(): string {
  // Chave para assinar o state (CSRF). Usa a secret do QB (sempre presente quando configurado).
  return process.env.QB_CLIENT_SECRET || process.env.ENCRYPTION_KEY || 'godmanager-qb-state';
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** State assinado (HMAC) contendo clientId + nonce + timestamp. */
export function buildState(clientId: string): string {
  const payload = JSON.stringify({ c: clientId, n: b64url(crypto.randomBytes(9)), t: Date.now() });
  const p = b64url(Buffer.from(payload, 'utf8'));
  const sig = b64url(crypto.createHmac('sha256', stateSecret()).update(p).digest());
  return `${p}.${sig}`;
}

/** Valida o state e devolve o clientId (ou null se inválido/expirado). Janela: 15 min. */
export function verifyState(state: string): string | null {
  try {
    const [p, sig] = String(state || '').split('.');
    if (!p || !sig) return null;
    const expected = b64url(crypto.createHmac('sha256', stateSecret()).update(p).digest());
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const json = JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) as {
      c?: string;
      t?: number;
    };
    if (!json?.c || !json?.t) return null;
    if (Date.now() - json.t > 15 * 60 * 1000) return null;
    return json.c;
  } catch {
    return null;
  }
}

export function buildAuthorizeUrl(clientId: string): string {
  const cfg = qbConfig();
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('client_id', cfg.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPE);
  url.searchParams.set('redirect_uri', cfg.redirectUri);
  url.searchParams.set('state', buildState(clientId));
  return url.toString();
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in?: number;
  token_type?: string;
};

async function tokenRequest(body: URLSearchParams): Promise<TokenResponse> {
  const cfg = qbConfig();
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`QuickBooks token: resposta inválida (${res.status})`);
  }
  if (!res.ok) {
    const j = json as { error?: string; error_description?: string };
    throw new Error(`QuickBooks token: ${j?.error || res.status}${j?.error_description ? ' — ' + j.error_description : ''}`);
  }
  return json as TokenResponse;
}

export function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const cfg = qbConfig();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: cfg.redirectUri,
  });
  return tokenRequest(body);
}

export function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken });
  return tokenRequest(body);
}

export async function saveIntegration(params: {
  clientId: string;
  realmId: string | null;
  tokens: TokenResponse;
  userId?: string | null;
}): Promise<void> {
  const { clientId, realmId, tokens, userId } = params;
  const expiresAt = new Date(Date.now() + (Number(tokens.expires_in) || 3600) * 1000);
  const enc = encryptField(tokens.access_token);
  const encR = encryptField(tokens.refresh_token);
  await prisma.clientIntegration.upsert({
    where: { clientId_provider: { clientId, provider: 'QUICKBOOKS' } },
    create: {
      clientId,
      provider: 'QUICKBOOKS',
      status: 'CONNECTED',
      accessToken: enc || '',
      refreshToken: encR,
      expiresAt,
      externalAccountId: realmId,
      scope: SCOPE,
      connectedByUserId: userId || null,
      lastSyncAt: new Date(),
    },
    update: {
      status: 'CONNECTED',
      accessToken: enc || '',
      refreshToken: encR,
      expiresAt,
      externalAccountId: realmId ?? undefined,
      scope: SCOPE,
      lastErrorAt: null,
      lastErrorMsg: null,
    },
  });
}

export type QbConnection = {
  clientId: string;
  realmId: string | null;
  status: string;
  connectedAt: Date;
  expiresAt: Date | null;
  lastSyncAt: Date | null;
};

export async function getConnectionStatus(clientId: string): Promise<QbConnection | null> {
  const row = await prisma.clientIntegration.findUnique({
    where: { clientId_provider: { clientId, provider: 'QUICKBOOKS' } },
    select: {
      clientId: true,
      externalAccountId: true,
      status: true,
      connectedAt: true,
      expiresAt: true,
      lastSyncAt: true,
    },
  });
  if (!row) return null;
  return {
    clientId: row.clientId,
    realmId: row.externalAccountId,
    status: row.status,
    connectedAt: row.connectedAt,
    expiresAt: row.expiresAt,
    lastSyncAt: row.lastSyncAt,
  };
}

/**
 * Devolve um access token válido (renova via refresh se expirado) + realmId.
 * Lança se não houver conexão ou o refresh falhar.
 */
export async function getValidAccessToken(clientId: string): Promise<{ accessToken: string; realmId: string | null }> {
  const row = await prisma.clientIntegration.findUnique({
    where: { clientId_provider: { clientId, provider: 'QUICKBOOKS' } },
  });
  if (!row) throw new Error('QuickBooks não conectado para este cliente.');
  const now = Date.now();
  const exp = row.expiresAt ? row.expiresAt.getTime() : 0;
  // margem de 60s
  if (exp - now > 60_000) {
    const at = decryptField(row.accessToken);
    if (at) return { accessToken: at, realmId: row.externalAccountId };
  }
  // precisa renovar
  const refresh = decryptField(row.refreshToken);
  if (!refresh) throw new Error('QuickBooks sem refresh token; reconecte.');
  try {
    const tokens = await refreshTokens(refresh);
    await saveIntegration({ clientId, realmId: row.externalAccountId, tokens });
    return { accessToken: tokens.access_token, realmId: row.externalAccountId };
  } catch (e) {
    await prisma.clientIntegration.update({
      where: { clientId_provider: { clientId, provider: 'QUICKBOOKS' } },
      data: { status: 'EXPIRED', lastErrorAt: new Date(), lastErrorMsg: e instanceof Error ? e.message : String(e) },
    });
    throw e;
  }
}

export async function revokeAndDisconnect(clientId: string): Promise<void> {
  const cfg = qbConfig();
  const row = await prisma.clientIntegration.findUnique({
    where: { clientId_provider: { clientId, provider: 'QUICKBOOKS' } },
  });
  if (!row) return;
  const token = decryptField(row.refreshToken) || decryptField(row.accessToken);
  if (token && cfg.isConfigured) {
    try {
      const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
      await fetch(REVOKE_URL, {
        method: 'POST',
        headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ token }),
      });
    } catch {
      // best-effort: mesmo se o revoke falhar, removemos localmente
    }
  }
  await prisma.clientIntegration.delete({
    where: { clientId_provider: { clientId, provider: 'QUICKBOOKS' } },
  });
}

/** Chamada autenticada à API do QuickBooks (renova token se preciso). */
export async function qbApiFetch(
  clientId: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const cfg = qbConfig();
  const { accessToken, realmId } = await getValidAccessToken(clientId);
  if (!realmId) throw new Error('QuickBooks sem realmId (empresa).');
  const base = cfg.apiBaseUrl.replace(/\/$/, '');
  const url = `${base}/v3/company/${encodeURIComponent(realmId)}/${path.replace(/^\//, '')}`;
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  headers.set('Accept', 'application/json');
  if (!headers.has('Content-Type') && init?.body) headers.set('Content-Type', 'application/json');
  return fetch(url, { ...init, headers });
}
