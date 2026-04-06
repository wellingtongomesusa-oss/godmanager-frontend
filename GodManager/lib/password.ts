const SALT = 'gm_v1_salt';

export function hashPassword(plain: string): string {
  if (typeof window !== 'undefined' && typeof btoa === 'function') {
    return btoa(`${plain}${SALT}`);
  }
  return Buffer.from(`${plain}${SALT}`).toString('base64');
}

export function verifyPassword(plain: string, hash: string): boolean {
  return hashPassword(plain) === hash;
}
