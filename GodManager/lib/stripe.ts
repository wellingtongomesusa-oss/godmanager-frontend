import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.warn('[stripe] STRIPE_SECRET_KEY is not set; Stripe API calls will fail.');
}

/** Pinned to Stripe SDK (`stripe` package) — use `Stripe.API_VERSION`, not a manual literal. */
export const stripe = new Stripe(STRIPE_SECRET_KEY || 'sk_placeholder', {
  apiVersion: Stripe.API_VERSION,
  typescript: true,
});

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
export const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY;

export function isStripeConfigured(): boolean {
  return !!(STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET);
}
