import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { ownerChargedAmount, parsePmPackage } from '@/lib/pmPackages';
import type { PmExpenseStatus, PmPackage } from '@prisma/client';
import { resolvePropertyId } from '@/lib/pmResolveProperty';
import { monthRefQueryValues, normalizeYearMonthForWrite } from '@/lib/pmMonthRef';

export const dynamic = 'force-dynamic';

function toJson(e: {
  id: string;
  propertyId: string;
  vendorId: string | null;
  serviceType: string | null;
  packageApplied: PmPackage;
  vendorCost: { toString(): string };
  ownerCharged: { toString(): string };
  serviceDate: Date | null;
  monthRef: string;
  status: PmExpenseStatus;
  description: string | null;
  property: { code: string; address: string; ownerName: string | null };
  vendor: { id: string; companyName: string; defaultPackage: PmPackage } | null;
}) {
  return {
    id: e.id,
    propertyId: e.propertyId,
    propertyCode: e.property.code,
    propAddress: e.property.address,
    ownerName: e.property.ownerName ?? '',
    vendorId: e.vendorId,
    vendorName: e.vendor?.companyName ?? '',
    serviceType: e.serviceType ?? '',
    packageApplied: e.packageApplied,
    vendorCost: e.vendorCost.toString(),
    ownerCharged: e.ownerCharged.toString(),
    serviceDate: e.serviceDate ? e.serviceDate.toISOString().slice(0, 10) : '',
    monthRef: e.monthRef,
    status: e.status,
    description: e.description ?? '',
  };
}

export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const monthRef = searchParams.get('monthRef') || undefined;

  try {
    const rows = await prisma.pmExpense.findMany({
      where: monthRef ? { monthRef: { in: monthRefQueryValues(monthRef) } } : undefined,
      include: {
        property: { select: { code: true, address: true, ownerName: true } },
        vendor: { select: { id: true, companyName: true, defaultPackage: true } },
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

    const vendorId = String(body.vendorId || '').trim() || null;
    if (vendorId) {
      const v = await prisma.pmVendor.findUnique({ where: { id: vendorId } });
      if (!v) return NextResponse.json({ ok: false, error: 'Vendor not found' }, { status: 404 });
    }

    const pkg =
      parsePmPackage(String(body.packageApplied ?? body.pmPackage ?? '')) ?? 'PACOTE_1';
    const vendorCost = Number(body.vendorCost);
    if (!Number.isFinite(vendorCost) || vendorCost < 0) {
      return NextResponse.json({ ok: false, error: 'vendorCost must be a non-negative number' }, { status: 400 });
    }

    const monthRef = normalizeYearMonthForWrite(String(body.monthRef || '').trim());
    if (!monthRef) {
      return NextResponse.json({ ok: false, error: 'monthRef must be YYYY-M(M)' }, { status: 400 });
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

    const row = await prisma.pmExpense.create({
      data: {
        propertyId: resolved.id,
        vendorId,
        serviceType: String(body.serviceType || '').trim() || null,
        packageApplied: pkg,
        vendorCost,
        ownerCharged: ownerCh,
        serviceDate: serviceDate && !Number.isNaN(serviceDate.getTime()) ? serviceDate : null,
        monthRef,
        status: st,
        description: String(body.description || '').trim() || null,
      },
      include: {
        property: { select: { code: true, address: true, ownerName: true } },
        vendor: { select: { id: true, companyName: true, defaultPackage: true } },
      },
    });
    return NextResponse.json({ ok: true, expense: toJson(row) });
  } catch (e) {
    console.error('[POST /api/pm/expenses]', e);
    return NextResponse.json({ ok: false, error: 'Failed to create expense' }, { status: 500 });
  }
}
