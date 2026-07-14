import { NextResponse } from 'next/server';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { qbApArSummary } from '@/lib/quickbooksPost';
import { getConnectionStatus } from '@/lib/quickbooks';

export const dynamic = 'force-dynamic';

/**
 * GET /api/quickbooks/ap-ar?clientId=
 * Contas a Pagar (Bills em aberto) + Contas a Receber (Invoices em aberto) do QuickBooks,
 * com totais e destaque de vencidos.
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  const url = new URL(req.url);
  const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

  const conn = await getConnectionStatus(scope.clientId);
  if (!conn || conn.status !== 'CONNECTED') {
    return NextResponse.json({ ok: true, connected: false });
  }

  try {
    const summary = await qbApArSummary(scope.clientId);
    return NextResponse.json({ ok: true, connected: true, ...summary });
  } catch (e) {
    console.error('[quickbooks/ap-ar]', e instanceof Error ? e.message : 'error');
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Falha ao ler AP/AR.' }, { status: 502 });
  }
}
