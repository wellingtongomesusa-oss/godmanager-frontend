import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { ownerChargedAmount, parsePmPackage } from '@/lib/pmPackages';
import type { PmExpenseStatus, PmPackage } from '@prisma/client';
import { resolvePropertyId } from '@/lib/pmResolveProperty';
import { normalizeYearMonthForWrite } from '@/lib/pmMonthRef';

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
    pmPackage: e.packageApplied,
    vendorCost: e.vendorCost.toString(),
    ownerCharged: e.ownerCharged.toString(),
    serviceDate: e.serviceDate ? e.serviceDate.toISOString().slice(0, 10) : '',
    monthRef: e.monthRef,
    status: e.status,
    description: e.description ?? '',
  };
}

const STATUS_SET = new Set<PmExpenseStatus>(['SCHEDULED', 'PAID', 'PENDING', 'CANCELLED']);

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
    }

    const cur = await prisma.pmExpense.findUnique({ where: { id: params.id } });
    if (!cur) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

    let propertyId = cur.propertyId;
    if (body.propertyId != null || body.propertyCode != null) {
      const r = await resolvePropertyId(String(body.propertyId || body.propertyCode).trim());
      if (!r) return NextResponse.json({ ok: false, error: 'Property not found' }, { status: 404 });
      propertyId = r.id;
    }

    let vendorId = cur.vendorId;
    if (body.vendorId !== undefined) {
      const vid = String(body.vendorId || '').trim() || null;
      if (vid) {
        const v = await prisma.pmVendor.findUnique({ where: { id: vid } });
        if (!v) return NextResponse.json({ ok: false, error: 'Vendor not found' }, { status: 404 });
        vendorId = vid;
      } else {
        vendorId = null;
      }
    }

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

    const row = await prisma.pmExpense.update({
      where: { id: params.id },
      data: {
        propertyId,
        vendorId,
        serviceType:
          body.serviceType !== undefined
            ? String(body.serviceType).trim() || null
            : cur.serviceType,
        packageApplied: pkg,
        vendorCost,
        ownerCharged,
        serviceDate,
        monthRef,
        status: st,
        description:
          body.description !== undefined ? String(body.description).trim() || null : cur.description,
      },
      include: {
        property: { select: { code: true, address: true, ownerName: true } },
        vendor: { select: { id: true, companyName: true, defaultPackage: true } },
      },
    });
    return NextResponse.json({ ok: true, expense: toJson(row) });
  } catch (e) {
    console.error('[PATCH /api/pm/expenses/:id]', e);
    return NextResponse.json({ ok: false, error: 'Failed to update expense' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    await prisma.pmExpense.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[DELETE /api/pm/expenses/:id]', e);
    return NextResponse.json({ ok: false, error: 'Failed to delete expense' }, { status: 500 });
  }
}
