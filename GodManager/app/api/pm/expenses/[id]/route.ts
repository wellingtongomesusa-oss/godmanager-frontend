import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { canAccessClientId, getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';
import {
  canAccessPmExpense,
  getPmExpensesListWhere,
  isFieldRole,
} from '@/lib/pmExpensesScope';
import { ownerChargedAmount, parsePmPackage } from '@/lib/pmPackages';
import type { Prisma, PmExpenseStatus, PmPackage } from '@prisma/client';
import { resolvePropertyId } from '@/lib/pmResolveProperty';
import { normalizeYearMonthForWrite } from '@/lib/pmMonthRef';
import { recordAudit } from '@/lib/auditServer';
import {
  pickTenantNameForProperty,
  pmExpensePropertyTenantSelect,
  type PropertyTenantPickInput,
} from '@/lib/pmPickTenantName';

export const dynamic = 'force-dynamic';

function parseMetadataInput(raw: unknown): Prisma.InputJsonValue | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null as unknown as Prisma.InputJsonValue;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Prisma.InputJsonValue;
  return undefined;
}

function parseIsVendorFree(raw: unknown): boolean | undefined {
  if (raw === undefined) return undefined;
  return raw === true || raw === 'true' || raw === 1 || raw === '1';
}

function parseRescheduleBy(raw: unknown): 'tenant' | 'vendor' {
  return raw === 'tenant' ? 'tenant' : 'vendor';
}

function mergeRescheduleMetadata(
  curMeta: Prisma.JsonValue | null,
  newDateIso: string,
  rescheduleBy: 'tenant' | 'vendor',
): Prisma.InputJsonValue {
  const base =
    curMeta && typeof curMeta === 'object' && !Array.isArray(curMeta)
      ? { ...(curMeta as Record<string, unknown>) }
      : {};
  const list = Array.isArray(base.reschedules) ? [...(base.reschedules as unknown[])] : [];
  list.push({ date: newDateIso, atIso: new Date().toISOString(), by: rescheduleBy });
  base.reschedules = list;
  return base as Prisma.InputJsonValue;
}

function toJson(e: {
  id: string;
  propertyId: string;
  vendorId: string | null;
  serviceType: string | null;
  packageApplied: PmPackage;
  vendorCost: { toString(): string };
  ownerCharged: { toString(): string };
  jobValueOverride?: { toString(): string } | null;
  serviceDate: Date | null;
  monthRef: string;
  status: PmExpenseStatus;
  description: string | null;
  isVendorFree: boolean;
  wasRescheduled: boolean;
  metadata: Prisma.JsonValue | null;
  finalizedAt?: Date | null;
  finalizedBy?: string | null;
  finalizedNote?: string | null;
  property: PropertyTenantPickInput & { code: string; address: string; ownerName: string | null };
  vendor: { id: string; companyName: string; defaultPackage: PmPackage } | null;
}) {
  const tenantName = pickTenantNameForProperty(e.property);
  return {
    id: e.id,
    propertyId: e.propertyId,
    propertyCode: e.property.code,
    propAddress: e.property.address,
    tenantName,
    ownerName: e.property.ownerName ?? '',
    vendorId: e.vendorId,
    vendorName: e.vendor?.companyName ?? '',
    serviceType: e.serviceType ?? '',
    packageApplied: e.packageApplied,
    pmPackage: e.packageApplied,
    vendorCost: e.vendorCost.toString(),
    ownerCharged: e.ownerCharged.toString(),
    jobValueOverride: e.jobValueOverride != null ? e.jobValueOverride.toString() : null,
    serviceDate: e.serviceDate ? e.serviceDate.toISOString().slice(0, 10) : '',
    monthRef: e.monthRef,
    status: e.status,
    description: e.description ?? '',
    finalizedAt: e.finalizedAt ? e.finalizedAt.toISOString() : null,
    finalizedBy: e.finalizedBy ?? null,
    finalizedNote: e.finalizedNote ?? '',
    isVendorFree: !!e.isVendorFree,
    wasRescheduled: !!e.wasRescheduled,
    metadata: e.metadata ?? null,
  };
}

const STATUS_SET = new Set<PmExpenseStatus>(['SCHEDULED', 'PAID', 'PENDING', 'CANCELLED', 'FINALIZED']);

function parseOptionalGeoNumber(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (isFieldRole(user)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
  const scopeUser = toClientScopeUser(user);

  try {
    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
    }

    const cur = await prisma.pmExpense.findFirst({
      where: { id: params.id, ...getPmExpensesListWhere(user) },
      select: {
        id: true,
        propertyId: true,
        vendorId: true,
        clientId: true,
        packageApplied: true,
        vendorCost: true,
        jobValueOverride: true,
        serviceType: true,
        serviceDate: true,
        monthRef: true,
        status: true,
        description: true,
        isVendorFree: true,
        wasRescheduled: true,
        metadata: true,
      },
    });
    if (!cur || !canAccessPmExpense(user, cur)) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    let propertyId = cur.propertyId;
    let shouldSyncExpenseClientId = false;
    let expenseClientIdForProperty: string | null = null;
    if (body.propertyId != null || body.propertyCode != null) {
      const r = await resolvePropertyId(String(body.propertyId || body.propertyCode).trim());
      if (!r) return NextResponse.json({ ok: false, error: 'Property not found' }, { status: 404 });
      const nextProp = await prisma.property.findUnique({
        where: { id: r.id },
        select: { clientId: true },
      });
      if (!nextProp) return NextResponse.json({ ok: false, error: 'Property not found' }, { status: 404 });
      if (!canAccessClientId(scopeUser, nextProp.clientId)) {
        return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
      }
      propertyId = r.id;
      shouldSyncExpenseClientId = true;
      expenseClientIdForProperty = nextProp.clientId;
    }

    const isVendorFreePatch = parseIsVendorFree(body.isVendorFree);
    let vendorId = cur.vendorId;
    if (isVendorFreePatch === true) {
      vendorId = null;
    } else if (body.vendorId !== undefined) {
      const vid = String(body.vendorId || '').trim() || null;
      if (vid) {
        const v = await prisma.pmVendor.findFirst({
          where: { id: vid, ...getClientScopeWhere(scopeUser) },
        });
        if (!v) return NextResponse.json({ ok: false, error: 'Vendor not found' }, { status: 404 });
        vendorId = vid;
      } else {
        vendorId = null;
      }
    }
    const metadataPatch = parseMetadataInput(body.metadata);

    let pkg: PmPackage = cur.packageApplied;
    if (body.packageApplied != null) {
      const p = parsePmPackage(String(body.packageApplied));
      if (p) pkg = p;
    } else if ((body as { pmPackage?: unknown }).pmPackage != null) {
      const p = parsePmPackage(String((body as { pmPackage?: unknown }).pmPackage));
      if (p) pkg = p;
    }

    let vendorCost = Number(cur.vendorCost);
    if (body.vendorCost != null) {
      const vc = Number(body.vendorCost);
      if (!Number.isFinite(vc) || vc < 0) {
        return NextResponse.json({ ok: false, error: 'Invalid vendorCost' }, { status: 400 });
      }
      vendorCost = vc;
    }

    const ownerCharged = ownerChargedAmount(vendorCost, pkg);

    let jobValueOverride: string | null | undefined;
    if ('jobValueOverride' in body) {
      if (body.jobValueOverride === null || body.jobValueOverride === '') {
        jobValueOverride = null;
      } else {
        const jvo = Number(body.jobValueOverride);
        if (!Number.isFinite(jvo) || jvo < 0) {
          return NextResponse.json({ ok: false, error: 'Invalid jobValueOverride' }, { status: 400 });
        }
        jobValueOverride = String(jvo);
      }
    }

    let monthRef = cur.monthRef;
    if (body.monthRef != null) {
      const m = normalizeYearMonthForWrite(String(body.monthRef));
      if (!m) {
        return NextResponse.json({ ok: false, error: 'monthRef must be YYYY-M(M)' }, { status: 400 });
      }
      monthRef = m;
    }

    let st = cur.status;
    if (body.status != null && STATUS_SET.has(body.status as PmExpenseStatus)) {
      st = body.status as PmExpenseStatus;
    }

    let serviceDate: Date | null = cur.serviceDate;
    if (body.serviceDate !== undefined) {
      if (!body.serviceDate) {
        serviceDate = null;
      } else {
        const d = new Date(String(body.serviceDate));
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json({ ok: false, error: 'Invalid serviceDate' }, { status: 400 });
        }
        serviceDate = d;
      }
    }

    // Determinar campos de finalização baseado no novo status
    const isFinalizingNow = st === 'FINALIZED' && cur.status !== 'FINALIZED';
    const isReactivating = cur.status === 'FINALIZED' && st !== 'FINALIZED';

    let executedAt: Date | null | undefined;
    let executedLat: number | null | undefined;
    let executedLng: number | null | undefined;
    let executedAccuracy: number | null | undefined;
    let executedByUserId: string | null | undefined;

    if (isFinalizingNow) {
      executedAt = new Date();
      executedByUserId = user.id;
      if (body.lat !== undefined) executedLat = parseOptionalGeoNumber(body.lat);
      if (body.lng !== undefined) executedLng = parseOptionalGeoNumber(body.lng);
      if (body.accuracy !== undefined) executedAccuracy = parseOptionalGeoNumber(body.accuracy);
    } else if (isReactivating) {
      executedAt = null;
      executedLat = null;
      executedLng = null;
      executedAccuracy = null;
      executedByUserId = null;
    }

    const changedFields: string[] = [];
    if (propertyId !== cur.propertyId) changedFields.push('propertyId');
    if (vendorId !== cur.vendorId) changedFields.push('vendorId');
    if (pkg !== cur.packageApplied) changedFields.push('packageApplied');
    if (vendorCost !== Number(cur.vendorCost)) changedFields.push('vendorCost');
    if (monthRef !== cur.monthRef) changedFields.push('monthRef');
    if (st !== cur.status) changedFields.push(`status:${cur.status}->${st}`);
    const nextServiceType =
      body.serviceType !== undefined
        ? String(body.serviceType).trim() || null
        : cur.serviceType;
    if (nextServiceType !== cur.serviceType) changedFields.push('serviceType');
    const prevSvc = cur.serviceDate?.toISOString().slice(0, 10) ?? '';
    const nextSvc = serviceDate?.toISOString().slice(0, 10) ?? '';
    if (prevSvc !== nextSvc) changedFields.push('serviceDate');
    const nextDesc =
      body.description !== undefined ? String(body.description).trim() || null : cur.description;
    if (nextDesc !== cur.description) changedFields.push('description');
    if (shouldSyncExpenseClientId) changedFields.push('clientId');
    if (jobValueOverride !== undefined) {
      const prevJvo = cur.jobValueOverride != null ? cur.jobValueOverride.toString() : null;
      const nextJvo = jobValueOverride;
      if (prevJvo !== nextJvo) {
        changedFields.push(
          nextJvo == null ? 'jobValueOverride:clear' : `jobValueOverride:${nextJvo}`,
        );
      }
    }
    if (isVendorFreePatch !== undefined && isVendorFreePatch !== cur.isVendorFree) {
      changedFields.push(`isVendorFree:${cur.isVendorFree}->${isVendorFreePatch}`);
    }
    if (metadataPatch !== undefined) changedFields.push('metadata');

    const isReschedulePatch =
      body.serviceDate !== undefined &&
      body.status != null &&
      st === 'SCHEDULED' &&
      nextSvc !== '' &&
      prevSvc !== nextSvc;

    let wasRescheduled = cur.wasRescheduled;
    let metadataForUpdate: Prisma.InputJsonValue | undefined = metadataPatch;
    if (isReschedulePatch) {
      const rescheduleBy = parseRescheduleBy(body.rescheduleBy);
      wasRescheduled = true;
      if (metadataPatch === undefined) {
        metadataForUpdate = mergeRescheduleMetadata(cur.metadata, nextSvc, rescheduleBy);
      }
      changedFields.push('wasRescheduled');
      if (metadataForUpdate !== undefined) changedFields.push(`reschedules:append:${rescheduleBy}`);
    }

    const row = await prisma.pmExpense.update({
      where: { id: params.id },
      data: {
        propertyId,
        ...(shouldSyncExpenseClientId ? { clientId: expenseClientIdForProperty } : {}),
        vendorId,
        serviceType:
          body.serviceType !== undefined
            ? String(body.serviceType).trim() || null
            : cur.serviceType,
        packageApplied: pkg,
        vendorCost,
        ownerCharged,
        ...(jobValueOverride !== undefined ? { jobValueOverride } : {}),
        serviceDate,
        monthRef,
        status: st,
        description:
          body.description !== undefined ? String(body.description).trim() || null : cur.description,
        finalizedAt: isFinalizingNow
          ? new Date()
          : isReactivating
            ? null
            : undefined,
        finalizedBy: isFinalizingNow
          ? body.finalizedBy
            ? String(body.finalizedBy).trim()
            : null
          : isReactivating
            ? null
            : undefined,
        finalizedNote: isFinalizingNow
          ? body.finalizedNote
            ? String(body.finalizedNote).trim()
            : null
          : isReactivating
            ? null
            : undefined,
        ...(executedAt !== undefined ? { executedAt } : {}),
        ...(executedLat !== undefined ? { executedLat } : {}),
        ...(executedLng !== undefined ? { executedLng } : {}),
        ...(executedAccuracy !== undefined ? { executedAccuracy } : {}),
        ...(executedByUserId !== undefined ? { executedByUserId } : {}),
        ...(isVendorFreePatch !== undefined ? { isVendorFree: isVendorFreePatch } : {}),
        wasRescheduled,
        ...(metadataForUpdate !== undefined ? { metadata: metadataForUpdate } : {}),
      },
      include: {
        property: { select: pmExpensePropertyTenantSelect },
        vendor: { select: { id: true, companyName: true, defaultPackage: true } },
      },
    });

    if (isFinalizingNow || isReactivating || changedFields.length > 0) {
      let action = 'pm_expense.update';
      if (isFinalizingNow) action = 'pm_expense.finalize';
      else if (isReactivating) action = 'pm_expense.reopen';

      await recordAudit({
        request: req,
        actor: { id: user.id, email: user.email },
        action,
        entity: 'pm_expense',
        entityId: params.id,
        details: `changed: ${changedFields.join(', ') || action}`,
        clientId: row.clientId ?? cur.clientId,
      });
    }

    return NextResponse.json({ ok: true, expense: toJson(row) });
  } catch (e) {
    console.error('[PATCH /api/pm/expenses/:id]', e);
    return NextResponse.json({ ok: false, error: 'Failed to update expense' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (isFieldRole(user)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const existing = await prisma.pmExpense.findFirst({
      where: { id: params.id, ...getPmExpensesListWhere(user) },
      select: { id: true, clientId: true, vendorId: true },
    });
    if (!existing || !canAccessPmExpense(user, existing)) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    await prisma.pmExpense.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[DELETE /api/pm/expenses/:id]', e);
    return NextResponse.json({ ok: false, error: 'Failed to delete expense' }, { status: 500 });
  }
}
