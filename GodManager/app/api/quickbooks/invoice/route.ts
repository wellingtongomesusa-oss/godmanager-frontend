import { NextResponse } from 'next/server';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { qbCreateInvoice } from '@/lib/quickbooksPost';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

/**
 * POST /api/quickbooks/invoice
 *   { clientId?, customerId, itemId, amount, txnDate?, dueDate?, memo?, description?, allowOnlinePayment? }
 * Cria uma Invoice (A/R) com link de pagamento online (requer QuickBooks Payments).
 */
export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const scope = await resolveBankAccountClientScope(user, (body?.clientId as string) ?? null);
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

  const customerId = String(body?.customerId || '').trim();
  const itemId = String(body?.itemId || '').trim();
  const amount = Number(body?.amount);
  if (!customerId) return NextResponse.json({ ok: false, error: 'customerId obrigatório.' }, { status: 400 });
  if (!itemId) return NextResponse.json({ ok: false, error: 'itemId obrigatório (produto/serviço ligado à conta de receita).' }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ ok: false, error: 'amount deve ser positivo.' }, { status: 400 });

  try {
    const result = await qbCreateInvoice(scope.clientId, {
      customerId,
      itemId,
      amount,
      txnDate: body?.txnDate ? String(body.txnDate).slice(0, 10) : null,
      dueDate: body?.dueDate ? String(body.dueDate).slice(0, 10) : null,
      memo: body?.memo ? String(body.memo).slice(0, 900) : null,
      description: body?.description ? String(body.description).slice(0, 900) : null,
      allowOnlinePayment: body?.allowOnlinePayment !== false,
    });
    await recordAudit({
      request: req,
      actor: { id: user.id, email: user.email },
      action: 'quickbooks.invoice.create',
      entity: 'quickbooks',
      entityId: result.id,
      clientId: scope.clientId,
      details: `amount:${amount.toFixed(2)} cust:${customerId} doc:${result.docNumber ?? ''}`,
    });
    return NextResponse.json({ ok: true, id: result.id, docNumber: result.docNumber, invoiceLink: result.invoiceLink });
  } catch (e) {
    console.error('[quickbooks/invoice]', e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Falha ao criar invoice.' }, { status: 502 });
  }
}
