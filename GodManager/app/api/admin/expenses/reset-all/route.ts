import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/requireSuperAdmin';
import { getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const gate = await requireSuperAdmin();
  if (gate.error) {
    return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  }
  const admin = gate.user;
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'Nao autenticado' }, { status: 401 });
  }
  try {
    const scopeUser = toClientScopeUser(admin);

    const body = await req.json().catch(() => ({}));
    const confirm = String((body as { confirm?: unknown }).confirm || '').trim();
    if (confirm !== 'DELETE ALL EXPENSES') {
      return NextResponse.json(
        { ok: false, error: 'Confirmation text required: DELETE ALL EXPENSES' },
        { status: 400 },
      );
    }

    const expenseWhere: Prisma.PmExpenseWhereInput =
      scopeUser.role === 'super_admin'
        ? {}
        : { ...(getClientScopeWhere(scopeUser) as Prisma.PmExpenseWhereInput) };

    const vendorPaymentWhere: Prisma.VendorPaymentWhereInput =
      scopeUser.role === 'super_admin'
        ? {}
        : { ...(getClientScopeWhere(scopeUser) as Prisma.VendorPaymentWhereInput) };

    const totalBefore = await prisma.pmExpense.count({ where: expenseWhere });
    const [expResult, vpResult] = await prisma.$transaction([
      prisma.pmExpense.deleteMany({ where: expenseWhere }),
      prisma.vendorPayment.deleteMany({ where: vendorPaymentWhere }),
    ]);
    const deleted = expResult.count;
    const vendorPaymentsDeleted = vpResult.count;

    await prisma.auditEntry
      .create({
        data: {
          actorId: admin.id,
          actorEmail: admin.email,
          action: 'reset_all_expenses',
          entity: 'pm_expense',
          entityId: null,
          details: JSON.stringify({
            deleted,
            before: totalBefore,
            vendorPaymentsDeleted,
            scope: scopeUser.role === 'super_admin' ? 'super_admin_global' : 'client_scoped',
            clientId: scopeUser.clientId,
          }),
          ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
          userAgent: req.headers.get('user-agent') || null,
        },
      })
      .catch((e) => {
        console.warn('[POST reset-all-expenses] audit', e);
      });

    return NextResponse.json({ ok: true, deleted, vendorPaymentsDeleted });
  } catch (e) {
    console.error('[POST reset-all-expenses]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
