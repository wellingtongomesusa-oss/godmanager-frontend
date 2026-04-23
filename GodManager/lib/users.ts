import type { User } from '@/lib/types';

async function j(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function normalizeUser(u: Partial<User> & { id: string }): User {
  return {
    id: u.id,
    firstName: u.firstName ?? '',
    lastName: u.lastName ?? '',
    email: u.email ?? '',
    phone: u.phone,
    role: (u.role ?? 'viewer') as User['role'],
    status: (u.status ?? 'pending') as User['status'],
    permissions: Array.isArray(u.permissions) ? u.permissions : [],
    createdAt:
      typeof u.createdAt === 'string'
        ? u.createdAt
        : u.createdAt
          ? new Date(u.createdAt as Date).toISOString()
          : new Date().toISOString(),
    lastActive:
      typeof u.lastActive === 'string'
        ? u.lastActive
        : u.lastActive
          ? new Date(u.lastActive as Date).toISOString()
          : new Date().toISOString(),
    passwordHash: u.passwordHash ?? '',
  };
}

export async function listUsers(): Promise<User[]> {
  try {
    const res = await fetch('/api/admin/users', { credentials: 'include', cache: 'no-store' });
    const data = await j(res);
    if (!res.ok || !data?.ok) return [];
    return ((data.users || []) as Partial<User>[]).map((u) => normalizeUser(u as User));
  } catch {
    return [];
  }
}

export async function getUserById(id: string): Promise<User | null> {
  try {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, { credentials: 'include', cache: 'no-store' });
    const data = await j(res);
    if (!res.ok || !data?.ok) return null;
    return normalizeUser(data.user as User);
  } catch {
    return null;
  }
}

export async function createUser(input: {
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
    return { ok: true, user: normalizeUser(data.user as User) };
  } catch (e) {
    console.error('[users.createUser]', e);
    return { ok: false, error: 'Erro de rede.' };
  }
}

export async function updateUser(
  id: string,
  patch: Partial<User> & { password?: string },
): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(patch),
    });
    const data = await j(res);
    if (!res.ok || !data?.ok) return { ok: false, error: data?.error || 'Falha ao actualizar utilizador.' };
    return { ok: true, user: normalizeUser({ ...(data.user as User), id } as User) };
  } catch (e) {
    console.error('[users.updateUser]', e);
    return { ok: false, error: 'Erro de rede.' };
  }
}

export async function deleteUser(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await j(res);
    if (!res.ok || !data?.ok) return { ok: false, error: data?.error || 'Falha ao eliminar utilizador.' };
    return { ok: true };
  } catch (e) {
    console.error('[users.deleteUser]', e);
    return { ok: false, error: 'Erro de rede.' };
  }
}

export async function emailExists(email: string, excludeId?: string): Promise<boolean> {
  try {
    const users = await listUsers();
    const norm = String(email).trim().toLowerCase();
    return users.some((u) => u.email.toLowerCase() === norm && u.id !== excludeId);
  } catch {
    return false;
  }
}

export function getUsersSync(): User[] {
  return [];
}
export function saveUsersSync(_users: User[]): void {}

// Compat para codigo legacy que usava getUsers() sincrono
export function getUsers(): User[] {
  return [];
}
export function getUserByEmail(_email: string): User | undefined {
  return undefined;
}
export function getUserByLoginIdentifier(_login: string): User | undefined {
  return undefined;
}
