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
 * GET /api/manager-pro/owner-statement/export-list?yearMonth=YYYY-MM&clientId=
 * Somente leitura. Retorna, para todas as casas do mes dentro do escopo do usuario, os totais
 * do statement (creditos, debitos e NET a pagar ao owner) para extracao em tabela/CSV.
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const scopeUser = toClientScopeUser(user);
    const url = new URL(req.url);
    const ym = normalizeYearMonthForWrite((url.searchParams.get('yearMonth') || '').trim());
    if (!ym || !YEAR_MONTH.test(ym)) {
      return NextResponse.json({ ok: false, error: 'Invalid yearMonth' }, { status: 400 });
    }
    const clientIdParam = (url.searchParams.get('clientId') || '').trim();

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
        totalIncome: true,
        totalExpenses: true,
        netPayout: true,
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
        credits: p.totalIncome != null ? Number(p.totalIncome) : 0,
        debits: p.totalExpenses != null ? Number(p.totalExpenses) : 0,
        net: p.netPayout != null ? Number(p.netPayout) : 0,
        status: p.paidAt != null ? 'Pago' : p.closedAt != null ? 'Fechado' : 'Aberto',
      }))
      .sort((a, b) => a.code.localeCompare(b.code));

    const totalCredits = Math.round(rows.reduce((s, r) => s + r.credits, 0) * 100) / 100;
    const totalDebits = Math.round(rows.reduce((s, r) => s + r.debits, 0) * 100) / 100;
    const totalNet = Math.round(rows.reduce((s, r) => s + r.net, 0) * 100) / 100;

    return NextResponse.json({
      ok: true,
      yearMonth: ym,
      count: rows.length,
      totals: { credits: totalCredits, debits: totalDebits, net: totalNet },
      rows,
    });
  } catch (e) {
    console.error('[GET /api/manager-pro/owner-statement/export-list]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
