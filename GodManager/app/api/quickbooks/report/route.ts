import { NextResponse } from 'next/server';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { qbProfitAndLoss, qbAccountsPayable } from '@/lib/quickbooksPost';
import { getConnectionStatus } from '@/lib/quickbooks';

export const dynamic = 'force-dynamic';

/**
 * GET /api/quickbooks/report?clientId=&from=&to=
 * Cards + gráfico com dados REAIS do QuickBooks: P&L (receita/despesa/lucro, série mensal) + contas a pagar.
 * Default: YTD (1 jan até hoje).
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

  // período: YTD por padrão (sem Date.now no server? aqui é rota Next, Date é permitido)
  const toDefault = new Date().toISOString().slice(0, 10);
  const yearStart = `${new Date().getUTCFullYear()}-01-01`;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('from') || '') ? url.searchParams.get('from')! : yearStart;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('to') || '') ? url.searchParams.get('to')! : toDefault;

  try {
    const [pnl, ap] = await Promise.all([
      qbProfitAndLoss(scope.clientId, from, to),
      qbAccountsPayable(scope.clientId).catch(() => 0),
    ]);
    return NextResponse.json({ ok: true, connected: true, from, to, pnl, accountsPayable: ap });
  } catch (e) {
    console.error('[quickbooks/report]', e instanceof Error ? e.message : 'error');
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Falha ao ler relatório.' }, { status: 502 });
  }
}
