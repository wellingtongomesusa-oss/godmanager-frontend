/**
 * Stripe – configuração e cliente.
 * Nunca expor STRIPE_SECRET_KEY no frontend.
 */

import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY;
const priceIdPro = process.env.STRIPE_PRICE_ID_PRO;

export const stripeConfig = {
  secretKey,
  priceIdPro,
  isConfigured(): boolean {
    return Boolean(secretKey && priceIdPro);
  },
  isWebhookConfigured(): boolean {
    return Boolean(process.env.STRIPE_WEBHOOK_SECRET);
  },
};

export function getStripe(): Stripe {
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY não configurada');
  return new Stripe(secretKey, { apiVersion: '2023-10-16' });
}
