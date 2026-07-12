import { NextResponse } from 'next/server';
import { stripe, isStripeConfigured } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

/**
 * POST /api/godrealtor/checkout
 * Checkout self-service do produto do mesmo grupo GODREALTOR (Florida real estate exam prep),
 * dentro do próprio site GodManager (Stripe Checkout).
 *
 * Preço e modo são CONFIGURÁVEIS por env — ajuste antes de divulgar:
 *   GODREALTOR_PRICE_CENTS  (default 9900 = $99)
 *   GODREALTOR_MODE         'payment' (uma vez, default) | 'subscription' (mensal)
 */
const PRICE_CENTS = Number(process.env.GODREALTOR_PRICE_CENTS || 9900);
const MODE = (process.env.GODREALTOR_MODE === 'subscription' ? 'subscription' : 'payment') as
  | 'payment'
  | 'subscription';
const ORIGIN = String(process.env.NEXTAUTH_URL || 'https://www.godmanager.us').replace(/\/$/, '');

export async function POST() {
  if (!isStripeConfigured()) {
    return NextResponse.json({ ok: false, error: 'stripe_not_configured' }, { status: 503 });
  }
  if (!Number.isFinite(PRICE_CENTS) || PRICE_CENTS <= 0) {
    return NextResponse.json({ ok: false, error: 'price_not_configured' }, { status: 503 });
  }
  try {
    const session = await stripe.checkout.sessions.create({
      mode: MODE,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'GODREALTOR — Florida Real Estate Exam Prep',
              metadata: { group: 'godroox', product: 'godrealtor_exam_prep' },
            },
            unit_amount: PRICE_CENTS,
            ...(MODE === 'subscription' ? { recurring: { interval: 'month' as const } } : {}),
          },
          quantity: 1,
        },
      ],
      success_url: 'https://www.godrealtor.us/?welcome=1',
      cancel_url: `${ORIGIN}/en/login`,
      metadata: { product: 'godrealtor_exam_prep', selfSignup: '1' },
    });
    return NextResponse.json({ ok: true, url: session.url });
  } catch (e) {
    console.error('[godrealtor/checkout]', e);
    return NextResponse.json({ ok: false, error: 'checkout_failed' }, { status: 500 });
  }
}
