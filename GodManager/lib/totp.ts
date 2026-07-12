import crypto from 'crypto';

/**
 * TOTP (RFC 6238) sem dependências externas — compatível com Google Authenticator,
 * Authy, 1Password, etc. Base32 (RFC 4648) para o segredo.
 */

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateBase32Secret(bytes = 20): string {
  const buf = crypto.randomBytes(bytes);
  let bits = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += B32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  return out;
}

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase();
  let bits = '';
  for (const c of clean) {
    const idx = B32_ALPHABET.indexOf(c);
    if (idx < 0) continue;
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  // counter é 32-bit safe para nossos propósitos (tempo/30)
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 1_000_000).toString().padStart(6, '0');
}

/** Verifica um token TOTP (janela ±1 período de 30s por padrão). */
export function verifyTotp(base32Secret: string, token: string, window = 1, stepSeconds = 30, nowMs?: number): boolean {
  const t = String(token || '').replace(/\D/g, '');
  if (t.length !== 6) return false;
  const secret = base32Decode(base32Secret);
  if (!secret.length) return false;
  const counter = Math.floor((nowMs ?? Date.now()) / 1000 / stepSeconds);
  for (let w = -window; w <= window; w++) {
    const candidate = hotp(secret, counter + w);
    // comparação em tempo constante
    if (candidate.length === t.length && crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(t))) return true;
  }
  return false;
}

/** URI otpauth:// para gerar o QR no app autenticador. */
export function otpauthUri(secret: string, account: string, issuer = 'GodManager'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: '6', period: '30' });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Gera N códigos de backup (mostrados uma vez) + seus hashes p/ armazenar. */
export function generateBackupCodes(n = 8): { codes: string[]; hashes: string[] } {
  const codes: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < n; i++) {
    const raw = crypto.randomBytes(5).toString('hex').slice(0, 10); // 10 hex
    const code = `${raw.slice(0, 5)}-${raw.slice(5)}`;
    codes.push(code);
    hashes.push(crypto.createHash('sha256').update(code.replace('-', '')).digest('hex'));
  }
  return { codes, hashes };
}

export function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(String(code || '').replace(/[^a-z0-9]/gi, '').toLowerCase()).digest('hex');
}
