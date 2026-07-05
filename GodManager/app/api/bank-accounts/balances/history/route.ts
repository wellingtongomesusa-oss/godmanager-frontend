import { NextResponse } from 'next/server';
import type { BankAccountType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import {
  canManageBankBalances,
  isValidBankAccountType,
  resolveBankAccountClientScope,
} from '@/lib/bankAccountBalancesScope';

export const dynamic = 'force-dynamic';

const MAX_POINTS = 24;

/**
 * GET /api/bank-accounts/balances/history?accountType=TRUST_CHASE
 * Série temporal de saldos por tipo de conta, para o gráfico de evolução nos cards da Home.
 * Sem accountType: devolve todos os tipos. Escopo por cliente (super_admin sem tenant → vazio).
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  }
  if (!canManageBankBalances(user.role)) {
    return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });
  }

  const url = new URL(req.url);
  const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
  if (!scope.ok) {
    // Sem cliente resolvível (ex.: super_admin sem tenant): devolve vazio em vez de 400.
    if (scope.status === 400) {
      return NextResponse.json({ ok: true, history: {} });
    }
    return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
  }

  const rawType = url.searchParams.get('accountType');
  const typeFilter =
    rawType && isValidBankAccountType(rawType) ? (rawType as BankAccountType) : null;

  try {
    const rows = await prisma.bankAccountBalance.findMany({
      where: {
        clientId: scope.clientId,
        ...(typeFilter ? { accountType: typeFilter } : {}),
      },
      orderBy: [{ balanceDate: 'asc' }, { recordedAt: 'asc' }],
      select: { accountType: true, balance: true, balanceDate: true },
    });

    // Agrupa por tipo; para cada data mantém o registro mais recente (série limpa, 1 ponto/dia).
    const byType: Record<string, Array<{ date: string; balance: number }>> = {};
    for (const r of rows) {
      const t = r.accountType as string;
      const date = r.balanceDate.toISOString().slice(0, 10);
      if (!byType[t]) byType[t] = [];
      const arr = byType[t];
      const point = { date, balance: Number(r.balance) };
      const last = arr[arr.length - 1];
      if (last && last.date === date) {
        arr[arr.length - 1] = point;
      } else {
        arr.push(point);
      }
    }
    // Limita aos últimos MAX_POINTS por tipo.
    for (const t of Object.keys(byType)) {
      if (byType[t].length > MAX_POINTS) {
        byType[t] = byType[t].slice(byType[t].length - MAX_POINTS);
      }
    }

    return NextResponse.json({ ok: true, history: byType });
  } catch (e) {
    console.error('[api/bank-accounts/balances/history GET]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}
