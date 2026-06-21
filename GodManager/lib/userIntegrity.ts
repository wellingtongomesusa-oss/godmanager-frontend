import type { UserRole, UserStatus } from '@prisma/client';

export const USER_INTEGRITY_MESSAGE =
  'Utilizador non-super_admin ativo exige clientId (empresa).';

export const USER_INTEGRITY_SELECT_COMPANY = 'Selecione a empresa do usuario';

export class UserIntegrityError extends Error {
  constructor(message = USER_INTEGRITY_MESSAGE) {
    super(message);
    this.name = 'UserIntegrityError';
  }
}

type UserIntegritySnapshot = {
  role: string;
  status: string;
  clientId: string | null;
};

export function isActiveNonSuperAdminWithoutClient(
  role: string,
  status: string,
  clientId: string | null | undefined,
): boolean {
  if (String(role).toLowerCase() === 'super_admin') return false;
  if (String(status).toLowerCase() !== 'active') return false;
  const cid = clientId == null ? '' : String(clientId).trim();
  return cid === '';
}

export function assertUserIntegrity(snapshot: UserIntegritySnapshot): void {
  if (isActiveNonSuperAdminWithoutClient(snapshot.role, snapshot.status, snapshot.clientId)) {
    throw new UserIntegrityError();
  }
}

function readClientId(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const t = value.trim();
    return t === '' ? null : t;
  }
  if (typeof value === 'object' && value !== null && 'set' in value) {
    return readClientId((value as { set: unknown }).set);
  }
  return null;
}

function readScalar(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'set' in value) {
    const set = (value as { set: unknown }).set;
    return typeof set === 'string' ? set : undefined;
  }
  return undefined;
}

/** Create / upsert.create — schema defaults: role viewer, status pending, clientId null. */
export function snapshotFromCreateData(data: Record<string, unknown>): UserIntegritySnapshot {
  const role = readScalar(data.role) ?? 'viewer';
  const status = readScalar(data.status) ?? 'pending';
  const clientId = 'clientId' in data ? readClientId(data.clientId) : null;
  return { role, status, clientId };
}

export function assertUserIntegrityOnCreate(data: Record<string, unknown>): void {
  assertUserIntegrity(snapshotFromCreateData(data));
}

/** Merge partial update with existing row (update / upsert.update). */
export function snapshotFromUpdate(
  existing: UserIntegritySnapshot,
  data: Record<string, unknown>,
): UserIntegritySnapshot {
  const role = readScalar(data.role) ?? existing.role;
  const status = readScalar(data.status) ?? existing.status;
  const clientId = 'clientId' in data ? readClientId(data.clientId) : existing.clientId;
  return { role, status, clientId };
}

export function assertUserIntegrityOnUpdate(
  existing: UserIntegritySnapshot,
  data: Record<string, unknown>,
): void {
  assertUserIntegrity(snapshotFromUpdate(existing, data));
}

export function updateDataTouchesIntegrity(data: Record<string, unknown>): boolean {
  return 'role' in data || 'status' in data || 'clientId' in data;
}

export function isUserIntegrityError(e: unknown): boolean {
  return e instanceof UserIntegrityError;
}

export function prismaRoleStatusClient(
  role: UserRole,
  status: UserStatus,
  clientId: string | null,
): UserIntegritySnapshot {
  return { role, status, clientId };
}
