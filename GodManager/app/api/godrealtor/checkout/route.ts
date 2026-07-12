import { NextRequest, NextResponse } from 'next/server';
import { stripe, isStripeConfigured } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

/**
 * POST /api/godrealtor/checkout  { plan?: '30' | '90' | '180' }
 * Checkout self-service do GODREALTOR (Florida real estate exam prep — audiobook),
 * pagamento único de acesso por X dias, dentro do próprio site GodManager (Stripe).
 * Preços conforme godrealtor.us. Ajustáveis por env (GODREALTOR_PRICE_*_CENTS).
 */
const PLANS: Record<string, { cents: number; days: number; label: string }> = {
  '30': { cents: Number(process.env.GODREALTOR_PRICE_30_CENTS || 1990), days: 30, label: '30 dias' },
  '90': { cents: Number(process.env.GODREALTOR_PRICE_90_CENTS || 4990), days: 90, label: '90 dias' },
  '180': { cents: Number(process.env.GODREALTOR_PRICE_180_CENTS || 8900), days: 180, label: '6 meses' },
};
const ORIGIN = String(process.env.NEXTAUTH_URL || 'https://www.godmanager.us').replace(/\/$/, '');

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ ok: false, error: 'stripe_not_configured' }, { status: 503 });
  }
  try {
    const body = (await req.json().catch(() => ({}))) as { plan?: string };
    const plan = PLANS[String(body?.plan || '90')] || PLANS['90'];
    if (!Number.isFinite(plan.cents) || plan.cents <= 0) {
      return NextResponse.json({ ok: false, error: 'price_not_configured' }, { status: 503 });
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `GODREALTOR — Florida Real Estate Exam Prep (${plan.label})`,
              description: `Acesso por ${plan.days} dias`,
              metadata: { group: 'godroox', product: 'godrealtor_exam_prep', days: String(plan.days) },
            },
            unit_amount: plan.cents,
          },
          quantity: 1,
        },
      ],
      success_url: 'https://www.godrealtor.us/?welcome=1',
      cancel_url: `${ORIGIN}/en/services`,
      metadata: { product: 'godrealtor_exam_prep', plan: String(plan.days), selfSignup: '1' },
    });
    return NextResponse.json({ ok: true, url: session.url });
  } catch (e) {
    console.error('[godrealtor/checkout]', e);
    return NextResponse.json({ ok: false, error: 'checkout_failed' }, { status: 500 });
  }
}
