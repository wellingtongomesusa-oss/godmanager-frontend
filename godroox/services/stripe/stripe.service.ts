/**
 * Stripe Service – godroox
 * Checkout, Payment Intents, validação de status.
 */

import Stripe from 'stripe';
import { stripeConfig } from './stripe.config';
import { logsService } from '@/services/logs.service';

function getStripe(): Stripe {
  if (!stripeConfig.secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(stripeConfig.secretKey, { apiVersion: '2023-10-16' });
}

export interface CreateCheckoutParams {
  amount: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  userId?: string;
  metadata?: Record<string, string>;
  description?: string;
}

export interface CheckoutResult {
  url: string;
  sessionId: string;
}

/**
 * Cria sessão de Checkout Stripe (suporte a cartões internacionais).
 */
export async function createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutResult> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: params.currency.toLowerCase(),
          product_data: {
            name: params.description ?? 'Pagamento Godroox',
            description: params.description ?? undefined,
          },
          unit_amount: Math.round(params.amount * 100),
        },
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      ...params.metadata,
      ...(params.userId && { userId: params.userId }),
    },
  });

  if (!session.url) {
    throw new Error('Stripe Checkout session URL missing');
  }

  logsService.info('stripe', 'Checkout session created', {
    sessionId: session.id,
    amount: params.amount,
    currency: params.currency,
    userId: params.userId,
  });

  return { url: session.url, sessionId: session.id };
}

/**
 * Recupera sessão de Checkout para validar status.
 */
export async function getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session | null> {
  const stripe = getStripe();
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });
    return session;
  } catch {
    return null;
  }
}

/**
 * Recupera Payment Intent para validação.
 */
export async function getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent | null> {
  const stripe = getStripe();
  try {
    return await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch {
    return null;
  }
}

export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'canceled';

/**
 * Mapeia status do Stripe para status interno.
 */
export function mapPaymentStatus(
  status: string,
  paymentStatus?: string
): PaymentStatus {
  if (status === 'succeeded' || paymentStatus === 'paid') return 'paid';
  if (status === 'processing' || paymentStatus === 'processing') return 'processing';
  if (status === 'canceled' || paymentStatus === 'canceled') return 'canceled';
  if (status === 'requires_payment_method' || status === 'requires_confirmation' || status === 'requires_action') return 'pending';
  return 'failed';
}
