import { NextResponse } from 'next/server';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { qbGetTxnDetail } from '@/lib/quickbooksPost';
import { getConnectionStatus } from '@/lib/quickbooks';

export const dynamic = 'force-dynamic';

/**
 * GET /api/quickbooks/txn-detail?type=invoice|bill&id=&clientId=
 * Detalhamento de uma conta a pagar (Bill) ou receber (Invoice) do QuickBooks.
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  const url = new URL(req.url);
  const type = url.searchParams.get('type') === 'bill' ? 'bill' : 'invoice';
  const id = (url.searchParams.get('id') || '').trim();
  if (!id) return NextResponse.json({ ok: false, error: 'id obrigatório.' }, { status: 400 });

  const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
  const conn = await getConnectionStatus(scope.clientId);
  if (!conn || conn.status !== 'CONNECTED') return NextResponse.json({ ok: false, error: 'QuickBooks não conectado.' }, { status: 400 });

  try {
    const detail = await qbGetTxnDetail(scope.clientId, type, id);
    if (!detail) return NextResponse.json({ ok: false, error: 'Transação não encontrada.' }, { status: 404 });
    return NextResponse.json({ ok: true, detail });
  } catch (e) {
    console.error('[quickbooks/txn-detail]', e instanceof Error ? e.message : 'error');
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Falha ao ler o detalhe.' }, { status: 502 });
  }
}
