import { NextResponse } from 'next/server';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { qbInvoiceLinkStats } from '@/lib/quickbooksPost';
import { getConnectionStatus } from '@/lib/quickbooks';

export const dynamic = 'force-dynamic';

/**
 * GET /api/quickbooks/link-stats?clientId=
 * Links de pagamento (invoices com pagamento online) gerados e pagos por mês.
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  const url = new URL(req.url);
  const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

  const conn = await getConnectionStatus(scope.clientId);
  if (!conn || conn.status !== 'CONNECTED') return NextResponse.json({ ok: true, connected: false });

  try {
    const stats = await qbInvoiceLinkStats(scope.clientId, 6);
    return NextResponse.json({ ok: true, connected: true, stats });
  } catch (e) {
    console.error('[quickbooks/link-stats]', e instanceof Error ? e.message : 'error');
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Falha ao ler estatísticas.' }, { status: 502 });
  }
}
