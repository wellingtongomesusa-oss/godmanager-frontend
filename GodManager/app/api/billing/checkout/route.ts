import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { stripe, isStripeConfigured } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { calculatePrice, type PricingInput } from '@/lib/billingPricing';
import type { BillingInterval, BusinessSegment } from '@prisma/client';

export const dynamic = 'force-dynamic';

const PUBLIC_ORIGIN = 'https://www.godmanager.us';

function billingOrigin(): string {
  const raw = process.env.NEXTAUTH_URL || PUBLIC_ORIGIN;
  return String(raw).replace(/\/$/, '');
}

function localePrefixFromRequest(req: NextRequest): string {
  const raw = req.cookies.get('NEXT_LOCALE')?.value?.toLowerCase() ?? '';
  if (raw === 'pt-br') return '/pt-br';
  if (raw === 'es') return '/es';
  return '/en';
}

/**
 * POST /api/billing/checkout
 * Creates (or retrieves) a Subscription record + Stripe Checkout Session.
 * Customer is redirected to the returned URL.
 */
export async function POST(req: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { ok: false, error: 'stripe_not_configured' },
        { status: 503 }
      );
    }

    const user = await getCurrentUserFromSession();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const segment = String(body?.segment || '').toUpperCase() as BusinessSegment;
    const packageTier = body?.packageTier != null ? Number(body.packageTier) : null;
    const avgRent = body?.avgRent != null ? Number(body.avgRent) : null;
    const avgVgv = body?.avgVgv != null ? Number(body.avgVgv) : null;
    const unitCount = body?.unitCount != null ? Number(body.unitCount) : null;
    const intervalRaw = String(body?.interval || 'MONTHLY').toUpperCase();
    const interval: BillingInterval = intervalRaw === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY';

    const pricingInput: PricingInput = { segment, packageTier, avgRent, avgVgv, unitCount };
    const pricing = calculatePrice(pricingInput);

    if (!pricing.ok) {
      return NextResponse.json({ ok: false, error: 'invalid_pricing_input', detail: pricing.error }, { status: 400 });
    }

    const amountUsd = interval === 'ANNUAL' ? pricing.annualTotal : pricing.monthlyTotal;
    const amountCents = Math.round(amountUsd * 100);

    if (amountCents < 50) {
      return NextResponse.json({ ok: false, error: 'amount_too_low', amountCents }, { status: 400 });
    }

    let subscription = await prisma.subscription.findUnique({ where: { userId: user.id } });
    if (!subscription) {
      const trialEnds = new Date();
      trialEnds.setDate(trialEnds.getDate() + 30);
      subscription = await prisma.subscription.create({
        data: {
          userId: user.id,
          status: 'TRIAL',
          trialStartsAt: new Date(),
          trialEndsAt: trialEnds,
        },
      });
    }

    let customerId = subscription.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: { userId: user.id, godmanagerSubId: subscription.id },
      });
      customerId = customer.id;
    }

    const origin = billingOrigin();
    const locPrefix = localePrefixFromRequest(req);
    const productName = `GodManager — ${segment}${packageTier ? ` P${packageTier}` : ''}`;
    const intervalLabel = interval === 'ANNUAL' ? 'year' : 'month';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: productName,
            metadata: {
              segment,
              packageTier: String(packageTier ?? ''),
              interval,
            },
          },
          recurring: { interval: intervalLabel },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      success_url: `${origin}${locPrefix}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${locPrefix}/billing/cancel`,
      metadata: {
        userId: user.id,
        subscriptionId: subscription.id,
        segment,
        packageTier: String(packageTier ?? ''),
        interval,
      },
    });

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        stripeCustomerId: customerId,
        segment,
        packageTier,
        interval,
        avgRent: avgRent != null ? new Prisma.Decimal(avgRent) : undefined,
        avgVgv: avgVgv != null ? new Prisma.Decimal(avgVgv) : undefined,
        unitCount: unitCount != null ? unitCount : undefined,
        pricePerUnit: new Prisma.Decimal(pricing.pricePerUnit),
        totalMonthly: new Prisma.Decimal(pricing.monthlyTotal),
      },
    });

    await prisma.billingEvent.create({
      data: {
        subscriptionId: subscription.id,
        eventType: 'checkout_session_created',
        amount: new Prisma.Decimal(amountUsd),
        metadata: {
          stripeSessionId: session.id,
          stripeCustomerId: customerId,
          interval,
          segment,
          packageTier,
        },
      },
    });

    return NextResponse.json({ ok: true, url: session.url, sessionId: session.id });
  } catch (e: any) {
    console.error('[/api/billing/checkout]', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'internal_error' },
      { status: 500 }
    );
  }
}
