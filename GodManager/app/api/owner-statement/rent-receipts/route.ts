import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import {
  canManageBankBalances,
  resolveBankAccountClientScope,
} from '@/lib/bankAccountBalancesScope';

export const dynamic = 'force-dynamic';

/**
 * GET /api/owner-statement/rent-receipts?clientId=
 * Aluguéis recebidos por mês (do general ledger) já com mgmt fee descontado.
 * Retorna totais mensais (p/ card + gráfico) e a quebra por casa (p/ detalhe).
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  }
  if (!canManageBankBalances(user.role)) {
    return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
    if (!scope.ok) {
      return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
    }

    const rows = await prisma.propertyRentReceipt.findMany({
      where: { clientId: scope.clientId },
      orderBy: [{ periodMonth: 'asc' }, { propertyLabel: 'asc' }],
    });

    const monthsMap = new Map<
      string,
      { month: string; gross: number; fee: number; net: number; count: number; properties: number }
    >();
    const byProperty = rows.map((r) => {
      const gross = Number(r.grossReceived);
      const fee = Number(r.mgmtFeeAmount);
      const net = Number(r.netOwner);
      const m = monthsMap.get(r.periodMonth) || {
        month: r.periodMonth,
        gross: 0,
        fee: 0,
        net: 0,
        count: 0,
        properties: 0,
      };
      m.gross += gross;
      m.fee += fee;
      m.net += net;
      m.count += r.paymentCount;
      m.properties += 1;
      monthsMap.set(r.periodMonth, m);
      return {
        propertyLabel: r.propertyLabel,
        propertyId: r.propertyId,
        matched: !!r.propertyId,
        periodMonth: r.periodMonth,
        gross,
        pct: Number(r.mgmtFeePct),
        fee,
        net,
        count: r.paymentCount,
      };
    });

    const months = [...monthsMap.values()].sort((a, b) => a.month.localeCompare(b.month));
    const latest = months.length ? months[months.length - 1].month : null;

    return NextResponse.json({
      ok: true,
      latest,
      months: months.map((m) => ({
        month: m.month,
        gross: Math.round(m.gross * 100) / 100,
        fee: Math.round(m.fee * 100) / 100,
        net: Math.round(m.net * 100) / 100,
        count: m.count,
        properties: m.properties,
      })),
      byProperty,
    });
  } catch (e) {
    console.error('[api/owner-statement/rent-receipts GET]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}
