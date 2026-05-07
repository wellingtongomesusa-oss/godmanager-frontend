import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { toClientScopeUser, canAccessClientId } from '@/lib/clientScope';
import { tenantPaymentAndBatchWhere } from '@/lib/tenantPaymentScope';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { tenantId: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const tenantId = params.tenantId;
  if (!tenantId) return NextResponse.json({ ok: false, error: 'Missing tenantId' }, { status: 400 });

  const scopeUser = toClientScopeUser(user);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, clientId: true },
  });
  if (!tenant) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  if (!canAccessClientId(scopeUser, tenant.clientId)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const scopeWhere = tenantPaymentAndBatchWhere(scopeUser);

  const payments = await prisma.tenantPayment.findMany({
    where: {
      tenantId,
      ...scopeWhere,
    },
    orderBy: { paymentDate: 'desc' },
    select: {
      id: true,
      paymentDate: true,
      receiptAmount: true,
      reference: true,
      type: true,
      cashAccount: true,
      counterpartAccount: true,
      payerName: true,
      description: true,
    },
  });

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  let totalAllTime = 0;
  let totalLast12Months = 0;
  for (const p of payments) {
    const amt = Number(p.receiptAmount);
    totalAllTime += amt;
    if (p.paymentDate >= twelveMonthsAgo) totalLast12Months += amt;
  }

  const paymentCount = payments.length;
  const latest = payments[0];
  const lastPaymentDate = latest ? latest.paymentDate.toISOString() : null;
  const lastPaymentAmount = latest ? Number(latest.receiptAmount) : 0;

  return NextResponse.json({
    payments: payments.map((p) => ({
      id: p.id,
      paymentDate: p.paymentDate.toISOString(),
      receiptAmount: Number(p.receiptAmount),
      reference: p.reference,
      type: p.type,
      cashAccount: p.cashAccount,
      counterpartAccount: p.counterpartAccount,
      payerName: p.payerName,
      description: p.description,
    })),
    summary: {
      totalAllTime,
      totalLast12Months,
      lastPaymentDate,
      lastPaymentAmount,
      paymentCount,
    },
  });
}
