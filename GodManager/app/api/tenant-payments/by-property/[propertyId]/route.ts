import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { toClientScopeUser, canAccessClientId } from '@/lib/clientScope';
import { tenantPaymentAndBatchWhere } from '@/lib/tenantPaymentScope';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { propertyId: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const propertyId = params.propertyId;
  if (!propertyId) return NextResponse.json({ ok: false, error: 'Missing propertyId' }, { status: 400 });

  const scopeUser = toClientScopeUser(user);

  const property = await prisma.property.findFirst({
    where: {
      OR: [{ id: propertyId }, { code: propertyId }],
    },
    select: { id: true, clientId: true, address: true, code: true },
  });
  if (!property) {
    return NextResponse.json({ ok: false, error: 'Property não encontrada' }, { status: 404 });
  }
  if (!canAccessClientId(scopeUser, property.clientId)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const scopeWhere = tenantPaymentAndBatchWhere(scopeUser);

  const payments = await prisma.tenantPayment.findMany({
    where: {
      propertyId: property.id,
      ...scopeWhere,
    },
    orderBy: { paymentDate: 'desc' },
    select: {
      id: true,
      tenantId: true,
      paymentDate: true,
      receiptAmount: true,
      reference: true,
      type: true,
      cashAccount: true,
      counterpartAccount: true,
      payerName: true,
      description: true,
      tenant: {
        select: { id: true, name: true },
      },
    },
  });

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const distinctTenantIds = new Set<string>();
  let totalAllTime = 0;
  let totalLast12Months = 0;
  for (const p of payments) {
    if (p.tenantId) distinctTenantIds.add(p.tenantId);
    const amt = Number(p.receiptAmount);
    totalAllTime += amt;
    if (p.paymentDate >= twelveMonthsAgo) totalLast12Months += amt;
  }
  const distinctTenantsCount = distinctTenantIds.size;

  const paymentCount = payments.length;
  const latest = payments[0];
  const lastPaymentDate = latest ? latest.paymentDate.toISOString() : null;
  const lastPaymentAmount = latest ? Number(latest.receiptAmount) : 0;

  return NextResponse.json({
    property: { id: property.id, code: property.code, address: property.address },
    payments: payments.map((p) => ({
      id: p.id,
      tenantId: p.tenantId,
      paymentDate: p.paymentDate.toISOString(),
      receiptAmount: Number(p.receiptAmount),
      reference: p.reference,
      type: p.type,
      cashAccount: p.cashAccount,
      counterpartAccount: p.counterpartAccount,
      payerName: p.payerName,
      description: p.description,
      tenant: p.tenant ? { id: p.tenant.id, name: p.tenant.name } : null,
    })),
    summary: {
      totalAllTime,
      totalLast12Months,
      lastPaymentDate,
      lastPaymentAmount,
      paymentCount,
      distinctTenantsCount,
    },
  });
}
