import { NextResponse } from 'next/server';
import type { Property } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { normalizePropertyMetadata } from '@/lib/photoMetadata';
import { canAccessClientId, getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

const SENSITIVE_PATCH_FIELDS = ['rent', 'deposit', 'guaranteeLimit', 'mgmtFeePct'] as const;
const AUDIT_DETAILS_MAX = 4000;

type BlockedDowngrade = { field: string; current: unknown; attempted: unknown };

function serialize(p: Property) {
  return {
    ...p,
    rent: p.rent.toString(),
    deposit: p.deposit.toString(),
    mgmtFeePct: p.mgmtFeePct.toString(),
    guaranteeLimit: p.guaranteeLimit != null ? p.guaranteeLimit.toString() : null,
    moveInDate: p.moveInDate ? p.moveInDate.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function asMeta(m: unknown): Record<string, unknown> {
  if (m && typeof m === 'object' && !Array.isArray(m)) return m as Record<string, unknown>;
  return {};
}

function decimalNum(v: unknown): number {
  if (v == null) return 0;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function isZeroOrEmpty(v: unknown): boolean {
  if (v === null || v === undefined || v === '') return true;
  const n = parseFloat(String(v));
  return !Number.isFinite(n) || n === 0;
}

function shouldBlockDowngrade(current: number, attempted: unknown, allowDowngrade: boolean): boolean {
  if (allowDowngrade) return false;
  return current > 0 && isZeroOrEmpty(attempted);
}

function mergePropertyMetadata(existing: unknown, patch: unknown): Record<string, unknown> {
  return { ...asMeta(existing), ...asMeta(patch) };
}

function metadataForAudit(meta: unknown): unknown {
  const m = asMeta(meta);
  const out: Record<string, unknown> = { ...m };
  if (Array.isArray(m.photos)) {
    out.photos = { length: m.photos.length };
  }
  return out;
}

function buildPatchAuditDetails(
  changes: Record<string, { old: unknown; new: unknown }>,
  blockedDowngrades: BlockedDowngrade[]
): string {
  const payload = { changes, blockedDowngrades };
  let s = JSON.stringify(payload);
  if (s.length <= AUDIT_DETAILS_MAX) return s;
  const slim = {
    changes,
    blockedDowngrades,
    _truncated: true,
    _originalLength: s.length,
  };
  s = JSON.stringify(slim);
  if (s.length <= AUDIT_DETAILS_MAX) return s;
  return s.slice(0, AUDIT_DETAILS_MAX);
}

function collectPatchChanges(
  before: Property,
  after: Property,
  dataKeys: string[]
): Record<string, { old: unknown; new: unknown }> {
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  for (const field of SENSITIVE_PATCH_FIELDS) {
    const oldStr = String(before[field]);
    const newStr = String(after[field]);
    if (oldStr !== newStr) {
      changes[field] = { old: oldStr, new: newStr };
    }
  }

  const oldGuarantee = asMeta(before.metadata).guarantee;
  const newGuarantee = asMeta(after.metadata).guarantee;
  const oldG = oldGuarantee == null || oldGuarantee === '' ? null : String(oldGuarantee);
  const newG = newGuarantee == null || newGuarantee === '' ? null : String(newGuarantee);
  if (oldG !== newG) {
    changes.guarantee = { old: oldG, new: newG };
  }

  for (const key of dataKeys) {
    if (
      key === 'metadata' ||
      (SENSITIVE_PATCH_FIELDS as readonly string[]).includes(key)
    ) {
      continue;
    }
    const oldVal = (before as Record<string, unknown>)[key];
    const newVal = (after as Record<string, unknown>)[key];
    const oldSerialized =
      oldVal instanceof Date ? oldVal.toISOString() : oldVal == null ? null : String(oldVal);
    const newSerialized =
      newVal instanceof Date ? newVal.toISOString() : newVal == null ? null : String(newVal);
    if (oldSerialized !== newSerialized) {
      changes[key] = { old: oldSerialized, new: newSerialized };
    }
  }

  if (dataKeys.includes('metadata')) {
    const oldMeta = metadataForAudit(before.metadata);
    const newMeta = metadataForAudit(after.metadata);
    if (JSON.stringify(oldMeta) !== JSON.stringify(newMeta)) {
      changes.metadata = { old: oldMeta, new: newMeta };
    }
  }

  return changes;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const p = await prisma.property.findUnique({ where: { id: params.id } });
    if (!p) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    const scopeUser = toClientScopeUser(user);
    if (!canAccessClientId(scopeUser, p.clientId)) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }
    return NextResponse.json({ ok: true, property: serialize(p) });
  } catch (e) {
    console.error('[GET /api/properties/:id]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const existing = await prisma.property.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    const scopeUser = toClientScopeUser(user);
    if (!canAccessClientId(scopeUser, existing.clientId)) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    if (body.address !== undefined) {
      const addr = String(body.address).trim();
      if (addr) {
        const scopeWhere = getClientScopeWhere(scopeUser);
        const conflict = await prisma.property.findFirst({
          where: {
            ...scopeWhere,
            id: { not: params.id },
            address: { equals: addr, mode: 'insensitive' },
          },
          select: { id: true },
        });
        if (conflict) {
          return NextResponse.json(
            { ok: false, error: 'duplicate_address', message: 'Propriedade duplicada' },
            { status: 409 }
          );
        }
      }
    }

    const allowDowngrade = body.allowDowngrade === true;
    const blockedDowngrades: BlockedDowngrade[] = [];
    const existingMeta = asMeta(existing.metadata);

    const data: Prisma.PropertyUpdateInput = {};
    if (body.address !== undefined) data.address = String(body.address);
    if (body.city !== undefined) data.city = (body.city as string) || null;
    if (body.state !== undefined) data.state = (body.state as string) || null;
    if (body.zip !== undefined) data.zip = (body.zip as string) || null;
    if (body.unitType !== undefined || body.type !== undefined) {
      data.unitType = ((body.unitType ?? body.type) as string) || null;
    }
    if (body.bedrooms !== undefined) {
      data.bedrooms = body.bedrooms != null ? Number(body.bedrooms) : null;
    }
    if (body.bathrooms !== undefined) {
      data.bathrooms = body.bathrooms != null ? Number(body.bathrooms) : null;
    }

    if (body.rent !== undefined) {
      const current = decimalNum(existing.rent);
      if (shouldBlockDowngrade(current, body.rent, allowDowngrade)) {
        blockedDowngrades.push({ field: 'rent', current: String(existing.rent), attempted: body.rent });
      } else {
        data.rent = String(body.rent);
      }
    }

    if (body.deposit !== undefined) {
      const current = decimalNum(existing.deposit);
      if (shouldBlockDowngrade(current, body.deposit, allowDowngrade)) {
        blockedDowngrades.push({
          field: 'deposit',
          current: String(existing.deposit),
          attempted: body.deposit,
        });
      } else {
        data.deposit = String(body.deposit);
      }
    }

    if (body.guaranteeLimit !== undefined) {
      const attempted =
        body.guaranteeLimit != null && body.guaranteeLimit !== '' ? body.guaranteeLimit : null;
      const current = decimalNum(existing.guaranteeLimit);
      if (shouldBlockDowngrade(current, attempted, allowDowngrade)) {
        blockedDowngrades.push({
          field: 'guaranteeLimit',
          current: existing.guaranteeLimit != null ? String(existing.guaranteeLimit) : null,
          attempted: body.guaranteeLimit,
        });
      } else {
        data.guaranteeLimit =
          body.guaranteeLimit != null && body.guaranteeLimit !== ''
            ? String(body.guaranteeLimit)
            : null;
      }
    }

    if (body.moveInDate !== undefined) {
      data.moveInDate = body.moveInDate ? new Date(String(body.moveInDate)) : null;
    }
    if (body.ownerName !== undefined) data.ownerName = (body.ownerName as string) || null;
    if (body.ownerEmail !== undefined) data.ownerEmail = (body.ownerEmail as string) || null;
    if (body.ownerPhone !== undefined) data.ownerPhone = (body.ownerPhone as string) || null;

    if (body.mgmtFeePct !== undefined) {
      const current = decimalNum(existing.mgmtFeePct);
      if (shouldBlockDowngrade(current, body.mgmtFeePct, allowDowngrade)) {
        blockedDowngrades.push({
          field: 'mgmtFeePct',
          current: String(existing.mgmtFeePct),
          attempted: body.mgmtFeePct,
        });
      } else {
        data.mgmtFeePct = String(body.mgmtFeePct);
      }
    }

    if (typeof body.hoaAdmin === 'boolean') data.hoaAdmin = body.hoaAdmin;
    if (body.status !== undefined) data.status = String(body.status);
    if (body.notes !== undefined) data.notes = (body.notes as string) || null;

    if (body.metadata !== undefined) {
      const mergedMeta = mergePropertyMetadata(existing.metadata, body.metadata);
      const currentGuarantee = decimalNum(existingMeta.guarantee);
      const attemptedGuarantee = mergedMeta.guarantee;
      if (shouldBlockDowngrade(currentGuarantee, attemptedGuarantee, allowDowngrade)) {
        blockedDowngrades.push({
          field: 'metadata.guarantee',
          current: existingMeta.guarantee ?? null,
          attempted: attemptedGuarantee ?? null,
        });
        if (existingMeta.guarantee !== undefined) {
          mergedMeta.guarantee = existingMeta.guarantee;
        } else {
          delete mergedMeta.guarantee;
        }
      }
      const normalized = normalizePropertyMetadata(mergedMeta);
      data.metadata = (normalized ?? Prisma.JsonNull) as Prisma.InputJsonValue;
    }

    const updated = await prisma.property.update({ where: { id: params.id }, data });

    const dataKeys = Object.keys(data);
    if (dataKeys.length > 0 || blockedDowngrades.length > 0) {
      const changes = collectPatchChanges(existing, updated, dataKeys);
      await recordAudit({
        request: req,
        actor: { id: user.id, email: user.email },
        action: 'property.update',
        entity: 'property',
        entityId: params.id,
        details: buildPatchAuditDetails(changes, blockedDowngrades),
        clientId: existing.clientId,
      });
    }

    return NextResponse.json({ ok: true, property: serialize(updated) });
  } catch (e) {
    console.error('[PATCH /api/properties/:id]', e);
    return NextResponse.json({ ok: false, error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const existing = await prisma.property.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    const scopeUser = toClientScopeUser(user);
    if (!canAccessClientId(scopeUser, existing.clientId)) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    await recordAudit({
      request: req,
      actor: { id: user.id, email: user.email },
      action: 'property.delete',
      entity: 'property',
      entityId: params.id,
      details: `code: ${existing.code || ''}`,
      clientId: existing.clientId,
    });

    await prisma.property.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as { code?: string };
    if (err?.code === 'P2025') {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }
    console.error('[DELETE /api/properties/:id]', e);
    return NextResponse.json({ ok: false, error: 'Failed to delete' }, { status: 500 });
  }
}
