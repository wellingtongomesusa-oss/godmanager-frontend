import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import {
  toClientScopeUser,
  getClientScopeWhere,
  canAccessClientId,
} from '@/lib/clientScope';
import { normalizeYearMonthForWrite } from '@/lib/pmMonthRef';

export const dynamic = 'force-dynamic';

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * GET /api/manager-pro/owner-statement/net-list?yearMonth=YYYY-MM&clientId=
 * Lista o NET real (OwnerMonthPayout.netPayout, recalculado do ledger) de TODAS as casas
 * do mês dentro do escopo do usuário. É o valor a pagar a cada owner.
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const scopeUser = toClientScopeUser(user);
    const url = new URL(req.url);
    const ymRaw = (url.searchParams.get('yearMonth') || '').trim();
    const ym = normalizeYearMonthForWrite(ymRaw);
    if (!ym || !YEAR_MONTH.test(ym)) {
      return NextResponse.json({ ok: false, error: 'Invalid yearMonth' }, { status: 400 });
    }
    const clientIdParam = (url.searchParams.get('clientId') || '').trim();

    // Escopo por casa. Super_admin pode restringir a uma empresa (clientId).
    const propWhere: Record<string, unknown> = { ...getClientScopeWhere(scopeUser) };
    if (clientIdParam) {
      if (!canAccessClientId(scopeUser, clientIdParam)) {
        return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
      }
      propWhere.clientId = clientIdParam;
    }

    const payouts = await prisma.ownerMonthPayout.findMany({
      where: { yearMonth: ym, property: propWhere },
      select: {
        netPayout: true,
        totalIncome: true,
        totalExpenses: true,
        closedAt: true,
        paidAt: true,
        paidAmount: true,
        property: {
          select: {
            code: true,
            address: true,
            ownerName: true,
            owner: { select: { name: true } },
          },
        },
      },
    });

    const rows = payouts
      .map((p) => ({
        code: p.property?.code ?? '',
        address: p.property?.address ?? '',
        ownerName: p.property?.owner?.name ?? p.property?.ownerName ?? '',
        netPayout: p.netPayout != null ? Number(p.netPayout) : 0,
        totalIncome: p.totalIncome != null ? Number(p.totalIncome) : 0,
        totalExpenses: p.totalExpenses != null ? Number(p.totalExpenses) : 0,
        closed: p.closedAt != null,
        paid: p.paidAt != null,
        paidAmount: p.paidAmount != null ? Number(p.paidAmount) : null,
      }))
      .sort((a, b) => a.code.localeCompare(b.code));

    const totalNet = Math.round(rows.reduce((s, r) => s + r.netPayout, 0) * 100) / 100;

    return NextResponse.json({ ok: true, yearMonth: ym, count: rows.length, totalNet, rows });
  } catch (e) {
    console.error('[GET /api/manager-pro/owner-statement/net-list]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
