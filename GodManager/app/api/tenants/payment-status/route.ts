import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';
import { tenantPaymentAndBatchWhere } from '@/lib/tenantPaymentScope';

export const dynamic = 'force-dynamic';

type PayStatus = 'paid' | 'late' | 'pending' | 'na';

export async function GET() {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const scopeUser = toClientScopeUser(user);
  const tenantWhere = getClientScopeWhere(scopeUser);
  const paymentScope = tenantPaymentAndBatchWhere(scopeUser);

  const now = new Date();
  const dayOfMonth = now.getUTCDate();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [tenants, paidRows] = await Promise.all([
    prisma.tenant.findMany({
      where: tenantWhere,
      select: { id: true, status: true, moveIn: true },
    }),
    prisma.tenantPayment.findMany({
      where: {
        ...paymentScope,
        paymentDate: { gte: startOfMonth },
        tenantId: { not: null },
        cashAccount: { startsWith: '1150' },
      },
      select: { tenantId: true },
    }),
  ]);

  const paidTenantIds = new Set<string>();
  for (const row of paidRows) {
    if (row.tenantId) paidTenantIds.add(row.tenantId);
  }

  const statusByTenantId: Record<string, PayStatus> = {};
  const summary = { paid: 0, late: 0, pending: 0, na: 0 };

  for (const t of tenants) {
    const statusNorm = String(t.status || '').toLowerCase().trim();
    const moveIn = t.moveIn;

    let st: PayStatus;
    if (statusNorm !== 'active' || !moveIn || moveIn.getTime() > now.getTime()) {
      st = 'na';
    } else if (dayOfMonth < 5) {
      st = 'pending';
    } else if (paidTenantIds.has(t.id)) {
      st = 'paid';
    } else {
      st = 'late';
    }

    statusByTenantId[t.id] = st;
    summary[st]++;
  }

  return NextResponse.json({ statusByTenantId, summary });
}
