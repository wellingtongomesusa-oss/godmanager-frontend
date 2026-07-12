import { NextResponse } from 'next/server';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { qbCreatePurchase, qbCreateBill, qbFindOrCreateVendor } from '@/lib/quickbooksPost';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

/**
 * POST /api/quickbooks/expense
 *   { clientId?, mode:'purchase'|'bill', amount, expenseAccountId,
 *     paymentAccountId?, paymentType?, vendorId?, vendorName?, txnDate?, dueDate?, memo?, description? }
 * purchase = despesa PAGA (débito despesa / crédito conta de pagamento).
 * bill     = despesa A PAGAR (débito despesa / crédito A/P; exige vendor).
 */
export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const scope = await resolveBankAccountClientScope(user, (body?.clientId as string) ?? null);
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

  const mode = String(body?.mode || 'purchase').toLowerCase();
  const amount = Number(body?.amount);
  const expenseAccountId = String(body?.expenseAccountId || '').trim();
  const txnDate = body?.txnDate ? String(body.txnDate).slice(0, 10) : null;
  const memo = body?.memo ? String(body.memo).slice(0, 900) : null;
  const description = body?.description ? String(body.description).slice(0, 900) : null;

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: 'amount deve ser positivo.' }, { status: 400 });
  }
  if (!expenseAccountId) {
    return NextResponse.json({ ok: false, error: 'expenseAccountId obrigatório.' }, { status: 400 });
  }

  try {
    // Resolve vendor (por id ou por nome, criando se preciso)
    let vendorId = body?.vendorId ? String(body.vendorId).trim() : '';
    const vendorName = body?.vendorName ? String(body.vendorName).trim() : '';
    if (!vendorId && vendorName) {
      vendorId = await qbFindOrCreateVendor(scope.clientId, vendorName);
    }

    let result: { id: string; docNumber: string | null };
    if (mode === 'bill') {
      if (!vendorId) {
        return NextResponse.json({ ok: false, error: 'Bill (A/P) exige vendor.' }, { status: 400 });
      }
      result = await qbCreateBill(scope.clientId, {
        amount,
        expenseAccountId,
        vendorId,
        txnDate,
        dueDate: body?.dueDate ? String(body.dueDate).slice(0, 10) : null,
        memo,
        description,
      });
    } else {
      const paymentAccountId = String(body?.paymentAccountId || '').trim();
      if (!paymentAccountId) {
        return NextResponse.json({ ok: false, error: 'Purchase exige paymentAccountId (banco/cartão).' }, { status: 400 });
      }
      const paymentType = ['CreditCard', 'Cash', 'Check'].includes(String(body?.paymentType))
        ? (String(body.paymentType) as 'CreditCard' | 'Cash' | 'Check')
        : 'CreditCard';
      result = await qbCreatePurchase(scope.clientId, {
        amount,
        expenseAccountId,
        paymentAccountId,
        paymentType,
        vendorId: vendorId || null,
        txnDate,
        memo,
        description,
      });
    }

    await recordAudit({
      request: req,
      actor: { id: user.id, email: user.email },
      action: mode === 'bill' ? 'quickbooks.bill.create' : 'quickbooks.purchase.create',
      entity: 'quickbooks',
      entityId: result.id,
      clientId: scope.clientId,
      details: `amount:${amount.toFixed(2)} acct:${expenseAccountId} doc:${result.docNumber ?? ''}`,
    });

    return NextResponse.json({ ok: true, mode, id: result.id, docNumber: result.docNumber });
  } catch (e) {
    console.error('[quickbooks/expense]', e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Falha ao lançar no QuickBooks.' }, { status: 502 });
  }
}
