import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';
import {
  monthBoundsUtc,
  parseYearMonth,
  paymentInMonthRef,
  recomputeInvoice,
} from '@/lib/rentInvoices';
import { decToNum } from '@/lib/loanBilling';

export const dynamic = 'force-dynamic';

type StatusEntry = {
  status: string;
  amount: number;
  lateFeeAmount: number;
  invoiceId: string;
};

/** Read-only: effective rent invoice status per property for a civil month (dry-run recompute). */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const scopeUser = toClientScopeUser(user);

  try {
    const { searchParams } = new URL(req.url);
    const month = parseYearMonth(searchParams.get('month'));
    if (!month) {
      return NextResponse.json(
        { ok: false, error: 'month (YYYY-MM) is required' },
        { status: 400 },
      );
    }

    const invoices = await prisma.rentInvoice.findMany({
      where: {
        ...getClientScopeWhere(scopeUser),
        monthRef: month,
        status: { not: 'cancelled' },
        type: { in: ['MOVE_IN', 'RENT'] },
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!invoices.length) {
      return NextResponse.json({ ok: true, month, byProperty: {} as Record<string, StatusEntry> });
    }

    const contractIds = [...new Set(invoices.map((i) => i.contractId))];
    const contracts = await prisma.leaseContract.findMany({
      where: { id: { in: contractIds }, ...getClientScopeWhere(scopeUser) },
    });
    const contractMap = new Map(contracts.map((c) => [c.id, c]));

    const propertyIds = [...new Set(invoices.map((i) => i.propertyId))];
    const bounds = monthBoundsUtc(month);
    const payments =
      bounds
        ? await prisma.tenantPayment.findMany({
            where: {
              ...getClientScopeWhere(scopeUser),
              propertyId: { in: propertyIds },
              cashAccount: { startsWith: '1150' },
              paymentDate: { gte: bounds.start, lte: bounds.end },
            },
            select: {
              propertyId: true,
              paymentDate: true,
              receiptAmount: true,
            },
          })
        : [];

    const asOf = new Date();
    const byProperty: Record<string, StatusEntry> = {};

    const invoiceByProperty = new Map<string, typeof invoices[number]>();
    for (const invoice of invoices) {
      const prev = invoiceByProperty.get(invoice.propertyId);
      if (!prev) {
        invoiceByProperty.set(invoice.propertyId, invoice);
        continue;
      }
      if (prev.type !== 'RENT' && invoice.type === 'RENT') {
        invoiceByProperty.set(invoice.propertyId, invoice);
      }
    }

    for (const invoice of invoiceByProperty.values()) {
      const contract = contractMap.get(invoice.contractId);
      if (!contract) continue;

      const invPayments = payments.filter(
        (p) =>
          p.propertyId === invoice.propertyId &&
          paymentInMonthRef(p.paymentDate, invoice.monthRef),
      );

      const next = recomputeInvoice(invoice, contract, invPayments, asOf);

      byProperty[invoice.propertyId] = {
        status: next.status,
        amount: decToNum(invoice.amount),
        lateFeeAmount: next.lateFeeAmount,
        invoiceId: invoice.id,
      };
    }

    return NextResponse.json({ ok: true, month, byProperty });
  } catch (e) {
    console.error('[GET /api/rent-invoices/status-by-month]', e);
    return NextResponse.json(
      { ok: false, error: 'Failed to load rent invoice status by month' },
      { status: 500 },
    );
  }
}
