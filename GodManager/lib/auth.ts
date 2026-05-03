import type { AuthPayload, User, UserRole } from '@/lib/types';

/** Synchronous JSON request (legacy callers: LoginForm, AuthProvider, password page). */
function syncJson<T = unknown>(method: string, url: string, body?: unknown): { ok: boolean; status: number; data: T | null } {
  const xhr = new XMLHttpRequest();
  xhr.open(method, url, false);
  if (body !== undefined) xhr.setRequestHeader('Content-Type', 'application/json');
  try {
    xhr.send(body !== undefined ? JSON.stringify(body) : null);
  } catch {
    return { ok: false, status: 0, data: null };
  }
  let data: T | null = null;
  try {
    data = xhr.responseText ? (JSON.parse(xhr.responseText) as T) : null;
  } catch {
    data = null;
  }
  return { ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data };
}

// --- Async API (fetch) — same contract as Fase 2 routes ---

export async function loginAsync(
  email: string,
  password: string,
): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) return { ok: false, error: data?.error || 'Login falhou.' };
    return { ok: true, user: data.user as User };
  } catch (e) {
    console.error('[auth.loginAsync]', e);
    return { ok: false, error: 'Erro de rede.' };
  }
}

export async function logoutAsync(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch (e) {
    console.error('[auth.logoutAsync]', e);
  }
}

export async function getCurrentUserAsync(): Promise<User | null> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.ok ? (data.user as User) : null;
  } catch {
    return null;
  }
}

export async function changePassword(
  oldPassword: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword, newPassword }),
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) return { ok: false, error: data?.error || 'Erro ao alterar password.' };
    return { ok: true };
  } catch (e) {
    console.error('[auth.changePassword]', e);
    return { ok: false, error: 'Erro de rede.' };
  }
}

// --- Sync API (XHR) — LoginForm, AuthProvider, useAuthPayload ---

export function login(email: string, password: string): { ok: true; user: User } | { ok: false; error: string } {
  const { ok, data } = syncJson<{ ok?: boolean; error?: string; user?: User }>('POST', '/api/auth/login', {
    email,
    password,
  });
  const d = data;
  if (!ok || !d?.ok || !d.user) return { ok: false, error: d?.error || 'Login falhou.' };
  return { ok: true, user: d.user as User };
}

export function logout(): void {
  try {
    syncJson('POST', '/api/auth/logout');
  } catch (e) {
    console.error('[auth.logout]', e);
  }
}

export function getCurrentUser(): User | null {
  const { ok, data } = syncJson<{ ok?: boolean; user?: User }>('GET', '/api/auth/me');
  const d = data;
  if (!ok || !d?.ok || !d.user) return null;
  return d.user as User;
}

export function isAuthenticatedSync(): boolean {
  return getCurrentUser() !== null;
}

export function getAuthPayload(): AuthPayload | null {
  const u = getCurrentUser();
  if (!u) return null;
  return {
    token: 'httpOnly-session',
    exp: Date.now() + 24 * 60 * 60 * 1000,
    userId: u.id,
    role: u.role as UserRole,
  };
}

export function isAuthenticated(): boolean {
  return getAuthPayload() !== null;
}

export function isAdmin(): boolean {
  const r = getAuthPayload()?.role;
  return r === 'admin' || r === 'super_admin';
}

/** No-op: sessão real é cookie HttpOnly definido pelo servidor. */
export function setAuthCookie(_payload: { exp: number; userId: string; role: UserRole }): void {}

export function clearAuthCookie(): void {}

export function saveAuthSession(_payload: AuthPayload): void {}

export function clearAuthSession(): void {}
