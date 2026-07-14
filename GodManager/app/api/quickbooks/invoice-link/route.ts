import { NextResponse } from 'next/server';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { qbGetInvoiceLink } from '@/lib/quickbooksPost';
import { getConnectionStatus } from '@/lib/quickbooks';

export const dynamic = 'force-dynamic';

/**
 * GET /api/quickbooks/invoice-link?id=<invoiceId>&clientId=
 * Retorna o link de pagamento (InvoiceLink) de uma invoice existente do QuickBooks.
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  const url = new URL(req.url);
  const id = (url.searchParams.get('id') || '').trim();
  if (!id) return NextResponse.json({ ok: false, error: 'id obrigatório.' }, { status: 400 });

  const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

  const conn = await getConnectionStatus(scope.clientId);
  if (!conn || conn.status !== 'CONNECTED') {
    return NextResponse.json({ ok: false, error: 'QuickBooks não conectado.' }, { status: 400 });
  }

  try {
    const { link } = await qbGetInvoiceLink(scope.clientId, id);
    if (link) return NextResponse.json({ ok: true, link });
    return NextResponse.json({
      ok: true,
      link: null,
      message: 'Sem link de pagamento. Ative o QuickBooks Payments no QuickBooks Online para gerar o link.',
    });
  } catch (e) {
    console.error('[quickbooks/invoice-link]', e instanceof Error ? e.message : 'error');
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Falha ao obter o link.' }, { status: 502 });
  }
}
