import type { BankLinkType } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  canAccessClientId,
  getClientScopeWhere,
  type ClientScopeUser,
} from '@/lib/clientScope';

export type BankLinkEntityResult =
  | { ok: true; clientId: string }
  | { ok: false; status: number; error: string };

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
