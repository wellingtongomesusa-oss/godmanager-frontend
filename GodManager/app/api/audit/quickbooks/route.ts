import { NextResponse } from 'next/server';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { getConnectionStatus } from '@/lib/quickbooks';
import { qbTransactionList } from '@/lib/quickbooksPost';
import { runAudit } from '@/lib/auditTransactions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/audit/quickbooks?from=YYYY-MM-DD&to=YYYY-MM-DD&clientId=
 * Roda a auditoria (trust accounting / FREC) DIRETO da API do QuickBooks já conectada —
 * sem download/upload de CSV. Somente leitura: não grava nada, não move dinheiro.
 * Restrito a super_admin/admin.
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  if (!['super_admin', 'admin'].includes(String(user.role))) {
    return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
    if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

    const conn = await getConnectionStatus(scope.clientId);
    if (!conn || conn.status !== 'CONNECTED') {
      return NextResponse.json({ ok: true, connected: false });
    }

    const to = (url.searchParams.get('to') || new Date().toISOString().slice(0, 10)).trim();
    const from = (url.searchParams.get('from') || '').trim() ||
      new Date(new Date(to).getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return NextResponse.json({ ok: false, error: 'Datas inválidas (use YYYY-MM-DD).' }, { status: 400 });
    }

    const rows = await qbTransactionList(scope.clientId, from, to);
    const result = runAudit(rows);
    return NextResponse.json({ ok: true, connected: true, from, to, source: 'quickbooks', ...result });
  } catch (e) {
    console.error('[GET /api/audit/quickbooks]', e instanceof Error ? e.message : 'error');
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Falha ao auditar via QuickBooks.' }, { status: 502 });
  }
}
