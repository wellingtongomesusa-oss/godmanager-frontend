import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripe, stripeConfig } from '@/lib/stripe';

export const runtime = 'nodejs';

/**
 * POST /api/stripe/webhook
 * Recebe eventos do Stripe. Configurar no Dashboard: Webhooks → Add endpoint → URL desta rota.
 * Usar o "Signing secret" (whsec_...) como STRIPE_WEBHOOK_SECRET.
 */
export async function POST(request: NextRequest) {
  if (!stripeConfig.isWebhookConfigured()) {
    return NextResponse.json({ error: 'Webhook não configurado' }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid signature';
    console.error('[api/stripe/webhook]', msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed':
      // Assinatura criada; pode salvar customer/subscription no seu banco aqui
      break;
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      // Atualizar status do plano no seu sistema
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
