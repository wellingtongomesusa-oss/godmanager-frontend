import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentAdminFromSession } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const admin = await getCurrentAdminFromSession();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'Forbidden - admin only' }, { status: 403 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const confirm = String((body as { confirm?: unknown }).confirm || '').trim();
    if (confirm !== 'DELETE ALL EXPENSES') {
      return NextResponse.json(
        { ok: false, error: 'Confirmation text required: DELETE ALL EXPENSES' },
        { status: 400 },
      );
    }
    const totalBefore = await prisma.pmExpense.count();
    const [expResult, vpResult] = await prisma.$transaction([
      prisma.pmExpense.deleteMany({}),
      prisma.vendorPayment.deleteMany({}),
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
            scope: 'all',
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
