import { STORAGE_KEYS } from '@/lib/constants';
import { SEED_USERS } from '@/lib/seed';
import type { User, UserRole, UserStatus } from '@/lib/types';

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

function asFullUser(u: Partial<User> & { id: string }): User {
  return {
    id: u.id,
    firstName: u.firstName ?? '',
    lastName: u.lastName ?? '',
    email: u.email ?? '',
    phone: u.phone,
    role: (u.role ?? 'viewer') as UserRole,
    status: (u.status ?? 'pending') as UserStatus,
    permissions: Array.isArray(u.permissions) ? u.permissions : [],
    createdAt: u.createdAt ?? new Date().toISOString(),
    lastActive: u.lastActive ?? new Date().toISOString(),
    passwordHash: u.passwordHash ?? '',
  };
}

/** Chamado pelo modal Add User imediatamente antes de createUser (password em claro para a API). */
let _primeCreatePassword: string | null = null;
export function primeUserCreatePassword(plain: string | null): void {
  _primeCreatePassword = plain;
}

function takePrimePassword(): string | null {
  const p = _primeCreatePassword;
  _primeCreatePassword = null;
  return p;
}

function migrateStoredUsers(users: User[]): User[] {
  let changed = false;
  const next = users.map((u) => {
    if (u.id === 'u-wellington' && u.email === 'admin@godmanager.com') {
      changed = true;
      return { ...u, email: 'wellington.gomes@godmanager.com' };
    }
    return u;
  });
  if (changed && typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(next));
  }
  return next;
}

function readRaw(): User[] {
  if (typeof window === 'undefined') return SEED_USERS;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.users);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(SEED_USERS));
      return [...SEED_USERS];
    }
    const parsed = JSON.parse(raw) as User[];
    const list = Array.isArray(parsed) ? parsed : SEED_USERS;
    return migrateStoredUsers(list);
  } catch {
    return SEED_USERS;
  }
}

function writeLocal(users: User[]): void {
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
}

async function j(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// --- Async (fetch) — mesmo contrato que /api/admin/users ---

export async function listUsers(): Promise<User[]> {
  try {
    const res = await fetch('/api/admin/users', { credentials: 'include', cache: 'no-store' });
    const data = await j(res);
    if (!res.ok || !data?.ok) return [];
    return ((data.users || []) as Partial<User>[]).map((u) => asFullUser(u as User));
  } catch {
    return [];
  }
}

export async function getUserByIdAsync(id: string): Promise<User | null> {
  try {
    const res = await fetch('/api/admin/users/' + encodeURIComponent(id), {
      credentials: 'include',
      cache: 'no-store',
    });
    const data = await j(res);
    if (!res.ok || !data?.ok) return null;
    return asFullUser(data.user as User);
  } catch {
    return null;
  }
}

export async function createUserAsync(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string | null;
  role?: string;
  status?: string;
  permissions?: string[];
}): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    const data = await j(res);
    if (!res.ok || !data?.ok) return { ok: false, error: data?.error || 'Falha ao criar utilizador.' };
    return { ok: true, user: asFullUser(data.user as User) };
  } catch (e) {
    console.error('[users.createUserAsync]', e);
    return { ok: false, error: 'Erro de rede.' };
  }
}

export async function updateUserAsync(
  id: string,
  patch: Partial<User> & { password?: string },
): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/admin/users/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(patch),
    });
    const data = await j(res);
    if (!res.ok || !data?.ok) return { ok: false, error: data?.error || 'Falha ao actualizar utilizador.' };
    return { ok: true, user: asFullUser({ ...(data.user as User), id } as User) };
  } catch (e) {
    console.error('[users.updateUserAsync]', e);
    return { ok: false, error: 'Erro de rede.' };
  }
}

export async function deleteUserAsync(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/admin/users/' + encodeURIComponent(id), {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await j(res);
    if (!res.ok || !data?.ok) return { ok: false, error: data?.error || 'Falha ao eliminar utilizador.' };
    return { ok: true };
  } catch (e) {
    console.error('[users.deleteUserAsync]', e);
    return { ok: false, error: 'Erro de rede.' };
  }
}

// --- Sync (XHR) — Admin UI existente ---

export function getUsers(): User[] {
  const { ok, data } = syncJson<{ ok?: boolean; users?: Partial<User>[] }>('GET', '/api/admin/users');
  const d = data;
  if (!ok || !d?.ok || !Array.isArray(d.users)) return [];
  return d.users.map((u) => asFullUser(u as User));
}

export function getUserById(id: string): User | undefined {
  const { ok, data } = syncJson<{ ok?: boolean; user?: Partial<User> }>(
    'GET',
    '/api/admin/users/' + encodeURIComponent(id),
  );
  const d = data;
  if (!ok || !d?.ok || !d.user) return undefined;
  return asFullUser(d.user as User);
}

export function emailExists(email: string, excludeId?: string): boolean {
  const norm = String(email).trim().toLowerCase();
  return getUsers().some((u) => u.email.toLowerCase() === norm && u.id !== excludeId);
}

export function createUser(user: User): void {
  const pw = takePrimePassword();
  if (pw && pw.length >= 8) {
    const { ok, data } = syncJson<{ ok?: boolean; error?: string; user?: Partial<User> }>('POST', '/api/admin/users', {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone ?? null,
      role: user.role,
      status: user.status,
      permissions: user.permissions,
      password: pw,
    });
    const d = data;
    if (ok && d?.ok) return;
    console.warn('[users.createUser] API create falhou, fallback localStorage:', d?.error);
  }
  const all = readRaw();
  writeLocal([...all, user]);
}

export function updateUser(id: string, patch: Partial<User> & { password?: string }): User | null {
  const body: Record<string, unknown> = {};
  if (patch.firstName !== undefined) body.firstName = patch.firstName;
  if (patch.lastName !== undefined) body.lastName = patch.lastName;
  if (patch.email !== undefined) body.email = patch.email;
  if (patch.phone !== undefined) body.phone = patch.phone;
  if (patch.role !== undefined) body.role = patch.role;
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.permissions !== undefined) body.permissions = patch.permissions;
  if (typeof patch.password === 'string' && patch.password.length > 0) body.password = patch.password;
  if (typeof patch.lastActive === 'string') body.lastActive = patch.lastActive;

  const { ok, data } = syncJson<{ ok?: boolean; user?: Partial<User>; error?: string }>(
    'PATCH',
    '/api/admin/users/' + encodeURIComponent(id),
    body,
  );
  const d = data;
  if (ok && d?.ok && d.user) return asFullUser({ ...(d.user as User), id } as User);

  const all = readRaw();
  const i = all.findIndex((u) => u.id === id);
  if (i < 0) return null;
  const merged = { ...all[i], ...patch, id: all[i].id };
  all[i] = merged;
  writeLocal(all);
  return merged;
}

export function deleteUser(id: string): void {
  const { ok, data } = syncJson<{ ok?: boolean; error?: string }>(
    'DELETE',
    '/api/admin/users/' + encodeURIComponent(id),
  );
  const d = data;
  if (ok && d?.ok) return;
  writeLocal(readRaw().filter((u) => u.id !== id));
}

export async function emailExistsAsync(email: string): Promise<boolean> {
  const users = await listUsers();
  const norm = String(email).trim().toLowerCase();
  return users.some((u) => u.email.toLowerCase() === norm);
}

export function getUsersSync(): User[] {
  return [];
}
export function saveUsersSync(_users: User[]): void {
  /* deprecated */
}

export function getUserByEmail(email: string): User | undefined {
  const e = email.trim().toLowerCase();
  return getUsers().find((u) => u.email.toLowerCase() === e);
}

export function getUserByLoginIdentifier(login: string): User | undefined {
  const raw = login.trim().toLowerCase();
  if (!raw) return undefined;
  const users = getUsers();
  const exact = users.find((u) => u.email.toLowerCase() === raw);
  if (exact) return exact;
  return users.find((u) => u.email.toLowerCase().split('@')[0] === raw);
}

export function touchLastActive(userId: string): void {
  updateUser(userId, { lastActive: new Date().toISOString() });
}

export function countByStatus(): Record<UserStatus, number> {
  const users = getUsers();
  return {
    active: users.filter((u) => u.status === 'active').length,
    suspended: users.filter((u) => u.status === 'suspended').length,
    pending: users.filter((u) => u.status === 'pending').length,
  };
}

export function countByRole(role: UserRole): number {
  return getUsers().filter((u) => u.role === role).length;
}
