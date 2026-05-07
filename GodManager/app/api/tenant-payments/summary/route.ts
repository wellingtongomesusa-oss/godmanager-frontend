import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { toClientScopeUser } from '@/lib/clientScope';
import { tenantPaymentAndBatchWhere } from '@/lib/tenantPaymentScope';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const scopeUser = toClientScopeUser(user);
  const where = tenantPaymentAndBatchWhere(scopeUser);
  const batchWhere = tenantPaymentAndBatchWhere(scopeUser);

  try {
    const [count, agg, payers, lastBatch] = await Promise.all([
      prisma.tenantPayment.count({ where }),
      prisma.tenantPayment.aggregate({
        where,
        _sum: { receiptAmount: true },
      }),
      prisma.tenantPayment.groupBy({
        by: ['payerName'],
        where,
      }),
      prisma.csvBatch.findFirst({
        where: { ...batchWhere, type: 'income_register' },
        orderBy: { uploadedAt: 'desc' },
        select: { uploadedAt: true },
      }),
    ]);

    const totalReceivedRaw = agg._sum.receiptAmount;
    const totalReceived =
      totalReceivedRaw != null ? Number(totalReceivedRaw.toString()) : 0;

    return NextResponse.json({
      totalPayments: count,
      totalReceived,
      distinctPayers: payers.length,
      lastBatchAt: lastBatch ? lastBatch.uploadedAt.toISOString() : null,
    });
  } catch (e) {
    console.error('[GET /api/tenant-payments/summary]', e);
    return NextResponse.json({ ok: false, error: 'Failed to load summary' }, { status: 500 });
  }
}
