/**
 * Stripe Config – godroox
 * Chaves, ambiente e validação. Nunca expor secret no frontend.
 */

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

export const stripeConfig = {
  secretKey: STRIPE_SECRET_KEY,
  webhookSecret: STRIPE_WEBHOOK_SECRET,
  publishableKey: STRIPE_PUBLISHABLE_KEY,
  isConfigured(): boolean {
    return Boolean(STRIPE_SECRET_KEY);
  },
  isWebhookConfigured(): boolean {
    return Boolean(STRIPE_WEBHOOK_SECRET);
  },
};
