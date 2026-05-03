import { NextRequest, NextResponse } from 'next/server';
import { stripe, isStripeConfigured } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

const PUBLIC_ORIGIN = 'https://www.godmanager.us';

/**
 * POST /api/billing/portal
 * Returns a URL to Stripe-hosted Customer Portal where user can manage
 * subscription, billing details, payment methods, cancel, etc.
 */
export async function POST(_req: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json({ ok: false, error: 'stripe_not_configured' }, { status: 503 });
    }

    const user = await getCurrentUserFromSession();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId: user.id },
    });

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json({ ok: false, error: 'no_stripe_customer' }, { status: 404 });
    }

    const origin = String(process.env.NEXTAUTH_URL || PUBLIC_ORIGIN).replace(/\/$/, '');
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${origin}/GodManager_Premium.html`,
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (e: any) {
    console.error('[/api/billing/portal]', e);
    return NextResponse.json({ ok: false, error: e?.message || 'internal_error' }, { status: 500 });
  }
}
