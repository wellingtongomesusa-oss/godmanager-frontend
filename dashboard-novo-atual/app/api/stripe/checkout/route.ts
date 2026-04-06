import { NextRequest, NextResponse } from 'next/server';
import { getStripe, stripeConfig } from '@/lib/stripe';

/**
 * POST /api/stripe/checkout
 * Cria sessão de Checkout Stripe para assinatura Pro com trial de 7 dias.
 * Body: { successUrl?: string, cancelUrl?: string }
 */
export async function POST(request: NextRequest) {
  try {
    if (!stripeConfig.isConfigured()) {
      return NextResponse.json(
        { error: 'Stripe não configurado. Defina STRIPE_SECRET_KEY e STRIPE_PRICE_ID_PRO.' },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const baseUrl = request.nextUrl.origin;
    const successUrl = body.successUrl ?? `${baseUrl}/admin/painel?stripe=success`;
    const cancelUrl = body.cancelUrl ?? baseUrl;

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripeConfig.priceIdPro!,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 7,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return NextResponse.json({ error: 'URL da sessão não retornada pelo Stripe.' }, { status: 500 });
    }

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (e) {
    console.error('[api/stripe/checkout]', e);
    const message = e instanceof Error ? e.message : 'Erro ao criar sessão de checkout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
