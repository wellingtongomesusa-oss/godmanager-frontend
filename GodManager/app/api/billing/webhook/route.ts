import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import type Stripe from 'stripe';
import { stripe, STRIPE_WEBHOOK_SECRET } from '@/lib/stripe';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function periodFromStripeSubscription(sub: Stripe.Subscription): {
  start: Date;
  end: Date;
} | null {
  const first = sub.items?.data?.[0];
  if (
    first &&
    typeof first.current_period_start === 'number' &&
    typeof first.current_period_end === 'number'
  ) {
    return {
      start: new Date(first.current_period_start * 1000),
      end: new Date(first.current_period_end * 1000),
    };
  }
  return null;
}

/** Stripe Invoice API (SDK Dahlia): subscription id lives under parent.subscription_details. */
function stripeInvoiceSubscriptionId(invoice: Stripe.Invoice): string | undefined {
  const p = invoice.parent;
  if (!p || p.type !== 'subscription_details') return undefined;
  const sub = p.subscription_details?.subscription;
  if (!sub) return undefined;
  return typeof sub === 'string' ? sub : sub.id;
}

function mapStripeStatus(stripeStatus: string): 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED' | 'GRANDFATHERED' {
  switch (stripeStatus) {
    case 'trialing':
      return 'TRIAL';
    case 'active':
      return 'ACTIVE';
    case 'past_due':
      return 'PAST_DUE';
    case 'canceled':
    case 'incomplete_expired':
      return 'CANCELLED';
    case 'unpaid':
      return 'PAST_DUE';
    default:
      return 'EXPIRED';
  }
}

/**
 * POST /api/billing/webhook
 * Receives Stripe webhook events. Validates signature, then processes:
 *   - checkout.session.completed
 *   - customer.subscription.updated
 *   - customer.subscription.deleted
 *   - invoice.paid
 *   - invoice.payment_failed
 *
 * Idempotent via stripeEventId unique constraint on BillingEvent.
 */
export async function POST(req: NextRequest) {
  if (!STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: 'webhook_not_configured' }, { status: 503 });
  }

  const sig = req.headers.get('stripe-signature') || '';
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (e: any) {
    console.error('[stripe-webhook] signature verification failed', e?.message);
    return NextResponse.json({ ok: false, error: 'invalid_signature' }, { status: 400 });
  }

  const existing = await prisma.billingEvent.findUnique({
    where: { stripeEventId: event.id },
  });
  if (existing) {
    return NextResponse.json({ ok: true, idempotent: true });
  }

  try {
    let subscriptionId: string | null = null;

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        subscriptionId = (session.metadata?.subscriptionId as string) || null;

        const stripeSubRef = session.subscription;
        const stripeSubId =
          typeof stripeSubRef === 'string' ? stripeSubRef : stripeSubRef?.id ?? null;

        if (subscriptionId && stripeSubId) {
          const custRef = session.customer;
          const custId = typeof custRef === 'string' ? custRef : custRef?.id;

          await prisma.subscription.update({
            where: { id: subscriptionId },
            data: {
              stripeSubscriptionId: stripeSubId,
              status: 'ACTIVE',
              ...(custId ? { stripeCustomerId: custId } : {}),
            },
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        let sub = event.data.object as Stripe.Subscription;
        if (!periodFromStripeSubscription(sub)) {
          sub = await stripe.subscriptions.retrieve(sub.id, { expand: ['items.data'] });
        }
        const dbSub = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: sub.id },
        });
        if (dbSub) {
          subscriptionId = dbSub.id;
          const period = periodFromStripeSubscription(sub);
          await prisma.subscription.update({
            where: { id: dbSub.id },
            data: {
              status: mapStripeStatus(sub.status),
              ...(period
                ? { currentPeriodStart: period.start, currentPeriodEnd: period.end }
                : {}),
              cancelAtPeriodEnd: sub.cancel_at_period_end || false,
            },
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const dbSub = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: sub.id },
        });
        if (dbSub) {
          subscriptionId = dbSub.id;
          await prisma.subscription.update({
            where: { id: dbSub.id },
            data: { status: 'CANCELLED' },
          });
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeSubId = stripeInvoiceSubscriptionId(invoice);
        if (stripeSubId) {
          const dbSub = await prisma.subscription.findFirst({
            where: { stripeSubscriptionId: stripeSubId },
          });
          if (dbSub) subscriptionId = dbSub.id;
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeSubId = stripeInvoiceSubscriptionId(invoice);
        if (stripeSubId) {
          const dbSub = await prisma.subscription.findFirst({
            where: { stripeSubscriptionId: stripeSubId },
          });
          if (dbSub) {
            subscriptionId = dbSub.id;
            await prisma.subscription.update({
              where: { id: dbSub.id },
              data: { status: 'PAST_DUE' },
            });
          }
        }
        break;
      }

      default:
        break;
    }

    if (subscriptionId) {
      await prisma.billingEvent.create({
        data: {
          subscriptionId,
          eventType: 'stripe_webhook',
          stripeEventId: event.id,
          stripeEventType: event.type,
          metadata: { eventType: event.type } as Prisma.InputJsonValue,
        },
      });
    }

    return NextResponse.json({ ok: true, eventType: event.type });
  } catch (e: any) {
    console.error('[stripe-webhook] processing error', e);
    return NextResponse.json({ ok: false, error: e?.message || 'internal_error' }, { status: 500 });
  }
}
