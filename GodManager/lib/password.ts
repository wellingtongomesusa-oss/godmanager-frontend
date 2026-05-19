import bcrypt from 'bcryptjs';

/** Legacy salted encoding (NOT cryptographically secure) — migrate to bcrypt via login rehash */
const SALT = 'gm_v1_salt';
const BCRYPT_ROUNDS = 12;

function legacyEncodePlain(plain: string): string {
  if (typeof window !== 'undefined' && typeof btoa === 'function') {
    return btoa(`${plain}${SALT}`);
  }
  return Buffer.from(`${plain}${SALT}`).toString('base64');
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  stored: string,
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
    const valid = await bcrypt.compare(plain, stored);
    return { valid, needsRehash: false };
  }
  const valid = verifyLegacyPassword(plain, stored);
  return { valid, needsRehash: valid };
}

function verifyLegacyPassword(plain: string, stored: string): boolean {
  return legacyEncodePlain(plain) === stored;
}
