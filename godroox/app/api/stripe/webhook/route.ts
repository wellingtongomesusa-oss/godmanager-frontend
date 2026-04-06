import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature, handleStripeWebhookEvent } from '@/services/stripe/stripe.webhooks';
import { stripeConfig } from '@/services/stripe/stripe.config';
import { logsService } from '@/services/logs.service';

/**
 * POST /api/stripe/webhook
 * Recebe eventos Stripe. Valida assinatura, processa e retorna 200.
 * Configurar em Stripe Dashboard: Webhooks → Add endpoint → URL desta rota.
 */
export async function POST(request: NextRequest) {
  try {
    if (!stripeConfig.isWebhookConfigured()) {
      logsService.error('stripe.webhook', 'STRIPE_WEBHOOK_SECRET not set');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }

    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature') ?? null;

    const event = verifyWebhookSignature(rawBody, signature);
    handleStripeWebhookEvent(event);

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Webhook error';
    logsService.error('stripe.webhook', message, { stack: e instanceof Error ? e.stack : undefined });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
