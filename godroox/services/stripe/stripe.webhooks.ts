/**
 * Stripe Webhooks – godroox
 * payment_intent.succeeded | failed | canceled; validação de assinatura e logs.
 */

import Stripe from 'stripe';
import { stripeConfig } from './stripe.config';
import { logsService } from '@/services/logs.service';

function getStripe(): Stripe {
  if (!stripeConfig.secretKey) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(stripeConfig.secretKey, { apiVersion: '2023-10-16' });
}

/**
 * Valida assinatura do webhook Stripe.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null
): Stripe.Event {
  if (!stripeConfig.webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET not configured');
  }
  if (!signature) {
    throw new Error('Missing Stripe-Signature header');
  }
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    stripeConfig.webhookSecret
  ) as Stripe.Event;
}

/**
 * Processa eventos do webhook.
 */
export function handleStripeWebhookEvent(event: Stripe.Event): void {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent;
      logsService.info('stripe.webhook', 'payment_intent.succeeded', {
        paymentIntentId: pi.id,
        amount: pi.amount,
        currency: pi.currency,
      });
      break;
    }
    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent;
      logsService.warn('stripe.webhook', 'payment_intent.payment_failed', {
        paymentIntentId: pi.id,
        amount: pi.amount,
        currency: pi.currency,
        error: pi.last_payment_error?.message,
      });
      break;
    }
    case 'payment_intent.canceled': {
      const pi = event.data.object as Stripe.PaymentIntent;
      logsService.info('stripe.webhook', 'payment_intent.canceled', {
        paymentIntentId: pi.id,
        amount: pi.amount,
        currency: pi.currency,
      });
      break;
    }
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      logsService.info('stripe.webhook', 'checkout.session.completed', {
        sessionId: session.id,
        paymentIntent: session.payment_intent,
        amountTotal: session.amount_total,
        currency: session.currency,
      });
      break;
    }
    default:
      logsService.info('stripe.webhook', `Unhandled event: ${event.type}`, {
        id: event.id,
        type: event.type,
      });
  }
}
