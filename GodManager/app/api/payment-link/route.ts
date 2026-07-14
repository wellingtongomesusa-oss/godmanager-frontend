import { NextResponse } from 'next/server';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { stripe } from '@/lib/stripe';
import { isStripeFallbackEnabled } from '@/lib/paymentLinkSettings';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payment-link  { amount, description?, reference? }
 * Gera um link de pagamento (Stripe Payment Link) para um valor avulso — usado para
 * cobrar uma conta a receber quando o QuickBooks Payments não está ativo.
 * O link é permanente e aceita cartão. Só admin/manager/super_admin.
 */
const ROLES = ['super_admin', 'admin', 'manager'];

export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  if (!ROLES.includes(String(user.role || '').toLowerCase())) {
    return NextResponse.json({ ok: false, error: 'Sem permissão para gerar link de cobrança.' }, { status: 403 });
  }
  // Interruptor (banco → env → padrão). Admin liga/desliga na tela sem tocar no Railway.
  if (!(await isStripeFallbackEnabled())) {
    return NextResponse.json({ ok: false, disabled: true, error: 'Cobrança por Stripe desativada.' }, { status: 503 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ ok: false, error: 'Stripe não configurado (defina STRIPE_SECRET_KEY).' }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { amount?: unknown; description?: unknown; reference?: unknown };
  const amount = Number(body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: 'Valor inválido.' }, { status: 400 });
  }
  const description = String(body?.description || 'Pagamento').slice(0, 250);
  const reference = body?.reference ? String(body.reference).slice(0, 120) : undefined;

  try {
    // Preço avulso (cria produto ad-hoc) → Payment Link permanente.
    const price = await stripe.prices.create({
      currency: 'usd',
      unit_amount: Math.round(amount * 100),
      product_data: { name: description },
    });
    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      ...(reference ? { metadata: { reference } } : {}),
    });

    await recordAudit({
      request: req,
      actor: { id: user.id, email: user.email },
      action: 'payment_link.create',
      entity: 'payment_link',
      entityId: link.id,
      clientId: user.clientId ?? undefined,
      details: `$${amount.toFixed(2)} ${reference ?? ''}`.trim(),
    });

    return NextResponse.json({ ok: true, url: link.url, id: link.id });
  } catch (e) {
    console.error('[payment-link]', e instanceof Error ? e.message : 'error');
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Falha ao gerar o link de pagamento.' }, { status: 502 });
  }
}
