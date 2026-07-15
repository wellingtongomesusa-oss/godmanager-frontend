import { NextResponse } from 'next/server';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { qbExpensesBreakdown } from '@/lib/quickbooksPost';
import { getConnectionStatus } from '@/lib/quickbooks';

export const dynamic = 'force-dynamic';

/**
 * GET /api/quickbooks/expenses-breakdown?clientId=&months=
 * Volume de despesas por merchant (fornecedor), por origem (conta/categoria) e por casa.
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  const url = new URL(req.url);
  const months = Math.min(24, Math.max(1, parseInt(url.searchParams.get('months') || '6', 10) || 6));
  const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

  const conn = await getConnectionStatus(scope.clientId);
  if (!conn || conn.status !== 'CONNECTED') return NextResponse.json({ ok: true, connected: false });

  try {
    const data = await qbExpensesBreakdown(scope.clientId, months);
    return NextResponse.json({ ok: true, connected: true, ...data });
  } catch (e) {
    console.error('[quickbooks/expenses-breakdown]', e instanceof Error ? e.message : 'error');
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Falha ao ler despesas.' }, { status: 502 });
  }
}
