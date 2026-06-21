import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';
import {
  monthBoundsUtc,
  paymentInMonthRef,
  recomputeInvoice,
  rentInvoiceToJson,
  toDecimalAmount,
  type RentInvoiceWithItems,
} from '@/lib/rentInvoices';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const scopeUser = toClientScopeUser(user);

  try {
    const body = await req.json().catch(() => ({}));
    const contractId =
      body && typeof body === 'object' ? String(body.contractId ?? '').trim() : '';
    const propertyId =
      body && typeof body === 'object' ? String(body.propertyId ?? '').trim() : '';

    if (!contractId && !propertyId) {
      return NextResponse.json(
        { ok: false, error: 'contractId or propertyId is required' },
        { status: 400 },
      );
    }

    if (propertyId) {
      const property = await prisma.property.findFirst({
        where: { id: propertyId, ...getClientScopeWhere(scopeUser) },
        select: { id: true },
      });
      if (!property) {
        return NextResponse.json({ ok: false, error: 'Property not found' }, { status: 404 });
      }
    }

    if (contractId) {
      const contract = await prisma.leaseContract.findFirst({
        where: { id: contractId, ...getClientScopeWhere(scopeUser) },
        select: { id: true },
      });
      if (!contract) {
        return NextResponse.json({ ok: false, error: 'Contract not found' }, { status: 404 });
      }
    }

    const invoices = await prisma.rentInvoice.findMany({
      where: {
        ...getClientScopeWhere(scopeUser),
        status: { not: 'cancelled' },
        ...(contractId ? { contractId } : {}),
        ...(propertyId ? { propertyId } : {}),
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { monthRef: 'asc' },
    });

    if (!invoices.length) {
      return NextResponse.json({
        ok: true,
        summary: { paid: 0, overdue: 0, open: 0, cancelled: 0, total: 0 },
        invoices: [],
      });
    }

    const contractIds = [...new Set(invoices.map((i) => i.contractId))];
    const contracts = await prisma.leaseContract.findMany({
      where: { id: { in: contractIds }, ...getClientScopeWhere(scopeUser) },
    });
    const contractMap = new Map(contracts.map((c) => [c.id, c]));

    const propertyIds = [...new Set(invoices.map((i) => i.propertyId))];
    const monthRefs = [...new Set(invoices.map((i) => i.monthRef))];

    let minStart: Date | null = null;
    let maxEnd: Date | null = null;
    for (const ym of monthRefs) {
      const bounds = monthBoundsUtc(ym);
      if (!bounds) continue;
      if (!minStart || bounds.start.getTime() < minStart.getTime()) minStart = bounds.start;
      if (!maxEnd || bounds.end.getTime() > maxEnd.getTime()) maxEnd = bounds.end;
    }

    const payments =
      minStart && maxEnd
        ? await prisma.tenantPayment.findMany({
            where: {
              ...getClientScopeWhere(scopeUser),
              propertyId: { in: propertyIds },
              cashAccount: { startsWith: '1150' },
              paymentDate: { gte: minStart, lte: maxEnd },
            },
            select: {
              propertyId: true,
              paymentDate: true,
              receiptAmount: true,
            },
          })
        : [];

    const asOf = new Date();
    const updatedRows: RentInvoiceWithItems[] = [];

    for (const invoice of invoices) {
      if (invoice.status === 'paid') {
        updatedRows.push(invoice);
        continue;
      }

      const contract = contractMap.get(invoice.contractId);
      if (!contract) {
        updatedRows.push(invoice);
        continue;
      }

      const invPayments = payments.filter(
        (p) =>
          p.propertyId === invoice.propertyId &&
          paymentInMonthRef(p.paymentDate, invoice.monthRef),
      );

      const next = recomputeInvoice(invoice, contract, invPayments, asOf);

      const row = await prisma.rentInvoice.update({
        where: { id: invoice.id },
        data: {
          status: next.status,
          paidAmount: next.paidAmount != null ? toDecimalAmount(next.paidAmount) : null,
          paidAt: next.paidAt,
          lateFeeAmount: toDecimalAmount(next.lateFeeAmount),
        },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });
      updatedRows.push(row);
    }

    const summary = { paid: 0, overdue: 0, open: 0, cancelled: 0, total: updatedRows.length };
    for (const inv of updatedRows) {
      if (inv.status === 'paid') summary.paid += 1;
      else if (inv.status === 'overdue') summary.overdue += 1;
      else if (inv.status === 'open') summary.open += 1;
      else if (inv.status === 'cancelled') summary.cancelled += 1;
    }

    return NextResponse.json({
      ok: true,
      summary,
      invoices: updatedRows.map((inv) => rentInvoiceToJson(inv, inv.items)),
    });
  } catch (e) {
    console.error('[POST /api/rent-invoices/reconcile]', e);
    return NextResponse.json({ ok: false, error: 'Failed to reconcile rent invoices' }, { status: 500 });
  }
}
