'use client';

import { AUTH_COOKIE, STORAGE_KEYS, TOKEN_TTL_MS } from '@/lib/constants';
import type { AuthPayload, User, UserRole } from '@/lib/types';
import { hashPassword, verifyPassword } from '@/lib/password';
import { getUserByLoginIdentifier, getUserById, touchLastActive, updateUser } from '@/lib/users';

function encodeCookiePayload(payload: { exp: number; userId: string; role: UserRole }): string {
  return typeof window !== 'undefined'
    ? btoa(JSON.stringify(payload))
    : Buffer.from(JSON.stringify(payload)).toString('base64');
}

export function setAuthCookie(payload: { exp: number; userId: string; role: UserRole }) {
  const encoded = encodeCookiePayload(payload);
  const maxAge = Math.max(0, Math.floor((payload.exp - Date.now()) / 1000));
  document.cookie = `${AUTH_COOKIE}=${encodeURIComponent(encoded)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function clearAuthCookie() {
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0`;
}

export function saveAuthSession(payload: AuthPayload) {
  localStorage.setItem(STORAGE_KEYS.auth, JSON.stringify(payload));
  setAuthCookie({ exp: payload.exp, userId: payload.userId, role: payload.role });
}

export function clearAuthSession() {
  localStorage.removeItem(STORAGE_KEYS.auth);
  clearAuthCookie();
}

export function getAuthPayload(): AuthPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.auth);
    if (!raw) return null;
    const p = JSON.parse(raw) as AuthPayload;
    if (!p.exp || Date.now() > p.exp) {
      clearAuthSession();
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

export function getCurrentUser(): User | null {
  const p = getAuthPayload();
  if (!p) return null;
  return getUserById(p.userId) ?? null;
}

export function login(email: string, password: string): { ok: true; user: User } | { ok: false; error: string } {
  const user = getUserByLoginIdentifier(email);
  if (!user) return { ok: false, error: 'Invalid email or password.' };
  if (user.status === 'suspended') return { ok: false, error: 'This account is suspended. Contact your administrator.' };
  if (user.status === 'pending') return { ok: false, error: 'Your access is still pending approval.' };
  if (!verifyPassword(password, user.passwordHash)) return { ok: false, error: 'Invalid email or password.' };

  const exp = Date.now() + TOKEN_TTL_MS;
  const token = `gm_${user.id}_${exp}`;
  const payload: AuthPayload = { token, exp, userId: user.id, role: user.role };
  saveAuthSession(payload);
  touchLastActive(user.id);

  return { ok: true, user };
}

export function logout() {
  clearAuthSession();
}

export function isAuthenticated(): boolean {
  return getAuthPayload() !== null;
}

export function isAdmin(): boolean {
  const p = getAuthPayload();
  return p?.role === 'admin';
}

/** API real quando ha cookie httpOnly; senao atualiza password em localStorage (demo). */
export async function changePassword(
  oldPassword: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (newPassword.length < 8) {
    return { ok: false, error: 'Nova password tem de ter pelo menos 8 caracteres.' };
  }
  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword, newPassword }),
      credentials: 'include',
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (res.ok && data.ok) return { ok: true };
  } catch (e) {
    console.error('[auth.changePassword]', e);
  }
  const u = getCurrentUser();
  if (!u) return { ok: false, error: 'Nao autenticado.' };
  if (!verifyPassword(oldPassword, u.passwordHash)) {
    return { ok: false, error: 'Password actual incorrecta.' };
  }
  const updated = updateUser(u.id, { passwordHash: hashPassword(newPassword) });
  if (!updated) return { ok: false, error: 'Falha ao actualizar password.' };
  return { ok: true };
}
