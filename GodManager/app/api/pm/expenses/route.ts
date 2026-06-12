import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import {
  canAccessClientId,
  getClientScopeForCreate,
  getClientScopeWhere,
  toClientScopeUser,
} from '@/lib/clientScope';
import { getPmExpensesListWhere, isFieldRole } from '@/lib/pmExpensesScope';
import { ownerChargedAmount, parsePmPackage } from '@/lib/pmPackages';
import type { Prisma, PmExpenseStatus, PmPackage } from '@prisma/client';
import { resolvePropertyId } from '@/lib/pmResolveProperty';
import { monthRefQueryValues, normalizeYearMonthForWrite } from '@/lib/pmMonthRef';
import { serviceDateToMonthRef } from '@/lib/pmCycleRef';
import {
  pickTenantNameForProperty,
  pmExpensePropertyTenantSelect,
  type PropertyTenantPickInput,
} from '@/lib/pmPickTenantName';

export const dynamic = 'force-dynamic';

function parseMetadataInput(raw: unknown): Prisma.InputJsonValue | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Prisma.InputJsonValue;
  return undefined;
}

function parseIsVendorFree(raw: unknown): boolean {
  return raw === true || raw === 'true' || raw === 1 || raw === '1';
}

function toJson(e: {
  id: string;
  propertyId: string;
  jobNumber?: number | null;
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
  property: PropertyTenantPickInput & { code: string; address: string; ownerName: string | null };
  vendor: { id: string; companyName: string; defaultPackage: PmPackage } | null;
  client?: { jobPrefix: string | null } | null;
}) {
  const tenantName = pickTenantNameForProperty(e.property);
  const jobNum = e.jobNumber ?? null;
  return {
    id: e.id,
    propertyId: e.propertyId,
    jobNumber: jobNum,
    jobLabel:
      jobNum != null
        ? `${e.client?.jobPrefix || 'JOB'}-${String(jobNum).padStart(4, '0')}`
        : null,
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
    isVendorFree: !!e.isVendorFree,
    wasRescheduled: !!e.wasRescheduled,
    metadata: e.metadata ?? null,
  };
}

export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const monthRef = searchParams.get('monthRef') || searchParams.get('month') || undefined;

  try {
    const rows = await prisma.pmExpense.findMany({
      where: {
        ...(monthRef ? { monthRef: { in: monthRefQueryValues(monthRef) } } : {}),
        ...getPmExpensesListWhere(user),
      },
      include: {
        property: { select: pmExpensePropertyTenantSelect },
        vendor: { select: { id: true, companyName: true, defaultPackage: true } },
        client: { select: { jobPrefix: true } },
      },
      orderBy: [{ monthRef: 'desc' }, { serviceDate: 'desc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json({ ok: true, expenses: rows.map(toJson) });
  } catch (e) {
    console.error('[GET /api/pm/expenses]', e);
    return NextResponse.json({ ok: false, error: 'Failed to list expenses' }, { status: 500 });
  }
}

const STATUS_SET = new Set<PmExpenseStatus>(['SCHEDULED', 'PAID', 'PENDING', 'CANCELLED']);

export async function POST(req: Request) {
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

    const propRef = String(body.propertyId || body.propertyCode || '').trim();
    const resolved = await resolvePropertyId(propRef);
    if (!resolved) {
      return NextResponse.json({ ok: false, error: 'Property not found' }, { status: 404 });
    }

    const prop = await prisma.property.findUnique({
      where: { id: resolved.id },
      select: { clientId: true },
    });
    if (!prop) {
      return NextResponse.json({ ok: false, error: 'Property not found' }, { status: 404 });
    }
    if (!canAccessClientId(scopeUser, prop.clientId)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const scopeClientId = getClientScopeForCreate(scopeUser);
    const expenseClientId = scopeClientId ?? prop.clientId ?? null;

    const isVendorFree = parseIsVendorFree(body.isVendorFree);
    let vendorId = String(body.vendorId || '').trim() || null;
    if (isVendorFree) {
      vendorId = null;
    } else if (vendorId) {
      const v = await prisma.pmVendor.findFirst({
        where: { id: vendorId, ...getClientScopeWhere(scopeUser) },
      });
      if (!v) return NextResponse.json({ ok: false, error: 'Vendor not found' }, { status: 404 });
    }
    const metadata = parseMetadataInput(body.metadata);

    const pkg =
      parsePmPackage(String(body.packageApplied ?? body.pmPackage ?? '')) ?? 'PACOTE_1';
    const vendorCost = Number(body.vendorCost);
    if (!Number.isFinite(vendorCost) || vendorCost < 0) {
      return NextResponse.json({ ok: false, error: 'vendorCost must be a non-negative number' }, { status: 400 });
    }

    // Derive monthRef from serviceDate if not explicitly provided (15-15 cycle)
    let monthRef: string | null = null;
    const explicitMonthRef = String(body.monthRef || '').trim();

    if (explicitMonthRef) {
      monthRef = normalizeYearMonthForWrite(explicitMonthRef);
      if (!monthRef) {
        return NextResponse.json({ ok: false, error: 'monthRef must be YYYY-M(M)' }, { status: 400 });
      }
    } else if (body.serviceDate) {
      monthRef = serviceDateToMonthRef(String(body.serviceDate));
      if (!monthRef) {
        return NextResponse.json({ ok: false, error: 'invalid serviceDate' }, { status: 400 });
      }
    } else {
      return NextResponse.json(
        { ok: false, error: 'monthRef or serviceDate required' },
        { status: 400 }
      );
    }

    let st: PmExpenseStatus = 'PENDING';
    if (body.status && STATUS_SET.has(body.status as PmExpenseStatus)) st = body.status as PmExpenseStatus;

    const serviceDate = body.serviceDate
      ? new Date(String(body.serviceDate))
      : null;
    if (serviceDate && Number.isNaN(serviceDate.getTime())) {
      return NextResponse.json({ ok: false, error: 'Invalid serviceDate' }, { status: 400 });
    }

    const ownerCh = ownerChargedAmount(vendorCost, pkg);

    const row = await prisma.$transaction(async (tx) => {
      let jobNumber: number | null = null;
      if (expenseClientId) {
        const c = await tx.client.update({
          where: { id: expenseClientId },
          data: { lastJobNumber: { increment: 1 } },
          select: { lastJobNumber: true },
        });
        jobNumber = c.lastJobNumber;
      }
      return tx.pmExpense.create({
        data: {
          propertyId: resolved.id,
          clientId: expenseClientId,
          vendorId,
          serviceType: String(body.serviceType || '').trim() || null,
          packageApplied: pkg,
          vendorCost,
          ownerCharged: ownerCh,
          serviceDate: serviceDate && !Number.isNaN(serviceDate.getTime()) ? serviceDate : null,
          monthRef,
          status: st,
          description: String(body.description || '').trim() || null,
          isVendorFree,
          ...(metadata !== undefined ? { metadata } : {}),
          ...(jobNumber != null ? { jobNumber } : {}),
        },
        include: {
          property: { select: pmExpensePropertyTenantSelect },
          vendor: { select: { id: true, companyName: true, defaultPackage: true } },
          client: { select: { jobPrefix: true } },
        },
      });
    });
    return NextResponse.json({ ok: true, expense: toJson(row) });
  } catch (e) {
    console.error('[POST /api/pm/expenses]', e);
    return NextResponse.json({ ok: false, error: 'Failed to create expense' }, { status: 500 });
  }
}
