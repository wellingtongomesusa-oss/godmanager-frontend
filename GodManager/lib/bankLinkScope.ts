import type { BankLinkType, User } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  canAccessClientId,
  getClientScopeWhere,
  type ClientScopeUser,
} from '@/lib/clientScope';
import type { UserRole } from '@/lib/types';

export type BankLinkEntityResult =
  | { ok: true; clientId: string }
  | { ok: false; status: number; error: string };

export type BankLinkEntityIdResult =
  | { ok: true; entityId: string }
  | { ok: false; status: number; error: string };

/** Session user fields needed for Plaid bank-link scope + role coercion. */
export type BankLinkActor = ClientScopeUser & {
  ownerId?: string | null;
  tenantId?: string | null;
};

export function toBankLinkActor(
  user: Pick<User, 'id' | 'role' | 'clientId' | 'ownerId'>,
): BankLinkActor {
  return {
    id: user.id,
    role: user.role as UserRole,
    clientId: user.clientId,
    ownerId: user.ownerId,
    tenantId: null,
  };
}

/**
 * Staff may pass any entityId within client scope. Owner/tenant portal roles
 * are pinned to their session entity (body/query ignored or must match).
 */
export function coerceBankLinkEntityId(
  actor: BankLinkActor,
  linkType: BankLinkType,
  requestedEntityId: string,
): BankLinkEntityIdResult {
  const requested = String(requestedEntityId || '').trim();

  if (actor.role === 'owner') {
    if (linkType !== 'OWNER') {
      return { ok: false, status: 403, error: 'Forbidden' };
    }
    const sessionOwnerId = String(actor.ownerId || '').trim();
    if (!sessionOwnerId) {
      return { ok: false, status: 403, error: 'Conta sem owner associado.' };
    }
    if (requested && requested !== sessionOwnerId) {
      return { ok: false, status: 403, error: 'Forbidden' };
    }
    return { ok: true, entityId: sessionOwnerId };
  }

  // When UserRole gains `tenant`, pin TENANT links to session tenantId.
  if ((actor.role as string) === 'tenant') {
    if (linkType !== 'TENANT') {
      return { ok: false, status: 403, error: 'Forbidden' };
    }
    const sessionTenantId = String(actor.tenantId || '').trim();
    if (!sessionTenantId) {
      return { ok: false, status: 403, error: 'Conta sem tenant associado.' };
    }
    if (requested && requested !== sessionTenantId) {
      return { ok: false, status: 403, error: 'Forbidden' };
    }
    return { ok: true, entityId: sessionTenantId };
  }

  if (!requested) {
    return { ok: false, status: 400, error: 'entityId obrigatorio.' };
  }
  return { ok: true, entityId: requested };
}

export function parseBankLinkType(raw: string | null | undefined): BankLinkType | null {
  const v = String(raw || '')
    .trim()
    .toUpperCase();
  if (v === 'TENANT' || v === 'OWNER' || v === 'CLIENT') return v as BankLinkType;
  return null;
}

/**
 * Valida entityId no escopo do cliente (somente SELECT em tenants/owners/clients).
 */
export async function resolveBankLinkEntity(
  scopeUser: ClientScopeUser,
  linkType: BankLinkType,
  entityId: string,
): Promise<BankLinkEntityResult> {
  const eid = String(entityId || '').trim();
  if (!eid) {
    return { ok: false, status: 400, error: 'entityId obrigatorio.' };
  }

  const scope = getClientScopeWhere(scopeUser);

  if (linkType === 'TENANT') {
    const tenant = await prisma.tenant.findFirst({
      where: { id: eid, ...scope },
      select: { id: true, clientId: true },
    });
    if (!tenant) {
      return { ok: false, status: 404, error: 'Tenant nao encontrado.' };
    }
    if (!tenant.clientId) {
      return { ok: false, status: 400, error: 'Tenant sem clientId.' };
    }
    if (!canAccessClientId(scopeUser, tenant.clientId)) {
      return { ok: false, status: 403, error: 'Forbidden' };
    }
    return { ok: true, clientId: tenant.clientId };
  }

  if (linkType === 'OWNER') {
    const owner = await prisma.owner.findFirst({
      where: { id: eid, ...scope },
      select: { id: true, clientId: true },
    });
    if (!owner) {
      return { ok: false, status: 404, error: 'Owner nao encontrado.' };
    }
    if (!canAccessClientId(scopeUser, owner.clientId)) {
      return { ok: false, status: 403, error: 'Forbidden' };
    }
    return { ok: true, clientId: owner.clientId };
  }

  const client = await prisma.client.findFirst({
    where: { id: eid, ...scope },
    select: { id: true },
  });
  if (!client) {
    return { ok: false, status: 404, error: 'Client nao encontrado.' };
  }
  if (!canAccessClientId(scopeUser, client.id)) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }
  return { ok: true, clientId: client.id };
}
