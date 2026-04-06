export const STORAGE_KEYS = {
  users: 'gm_users_v1',
  audit: 'gm_audit_v1',
  auth: 'gm_auth_token_v1',
} as const;

export const AUTH_COOKIE = 'gm_auth';

export const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_ADMIN_EMAIL = 'admin@godmanager.com';
export const DEFAULT_ADMIN_PASSWORD = 'GodManager2026!';
