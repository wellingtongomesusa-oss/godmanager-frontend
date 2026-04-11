import { STORAGE_KEYS } from '@/lib/constants';
import { hashPassword } from '@/lib/password';
import { SEED_USERS } from '@/lib/seed';
import type { User, UserRole, UserStatus } from '@/lib/types';

function migrateStoredUsers(users: User[]): User[] {
  let changed = false;
  const next = users.map((u) => {
    if (u.id === 'u-wellington' && u.email === 'admin@godmanager.com') {
      changed = true;
      return {
        ...u,
        email: 'wellington.gomes@godmanager.com',
        passwordHash: hashPassword('Invoice@123'),
      };
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

function write(users: User[]) {
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
}

export function getUsers(): User[] {
  return readRaw();
}

export function getUserById(id: string): User | undefined {
  return readRaw().find((u) => u.id === id);
}

export function getUserByEmail(email: string): User | undefined {
  const e = email.trim().toLowerCase();
  return readRaw().find((u) => u.email.toLowerCase() === e);
}

/** Aceita e-mail completo ou só a parte antes do @ (ex.: wellington.gomes → wellington.gomes@…). */
export function getUserByLoginIdentifier(login: string): User | undefined {
  const raw = login.trim().toLowerCase();
  if (!raw) return undefined;
  const users = readRaw();
  const exact = users.find((u) => u.email.toLowerCase() === raw);
  if (exact) return exact;
  return users.find((u) => u.email.toLowerCase().split('@')[0] === raw);
}

export function emailExists(email: string, excludeId?: string): boolean {
  const e = email.trim().toLowerCase();
  return readRaw().some((u) => u.email.toLowerCase() === e && u.id !== excludeId);
}

export function createUser(user: User): void {
  const all = readRaw();
  write([...all, user]);
}

export function updateUser(id: string, patch: Partial<User>): User | null {
  const all = readRaw();
  const i = all.findIndex((u) => u.id === id);
  if (i < 0) return null;
  const next = { ...all[i], ...patch, id: all[i].id };
  all[i] = next;
  write(all);
  return next;
}

export function deleteUser(id: string): void {
  write(readRaw().filter((u) => u.id !== id));
}

export function touchLastActive(userId: string): void {
  updateUser(userId, { lastActive: new Date().toISOString() });
}

export function countByStatus(): Record<UserStatus, number> {
  const users = readRaw();
  return {
    active: users.filter((u) => u.status === 'active').length,
    suspended: users.filter((u) => u.status === 'suspended').length,
    pending: users.filter((u) => u.status === 'pending').length,
  };
}

export function countByRole(role: UserRole): number {
  return readRaw().filter((u) => u.role === role).length;
}
