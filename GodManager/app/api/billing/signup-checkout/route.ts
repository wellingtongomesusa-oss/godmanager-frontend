import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { stripe, isStripeConfigured } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { calculatePrice, type PricingInput } from '@/lib/billingPricing';
import type { BillingInterval, BusinessSegment } from '@prisma/client';

export const dynamic = 'force-dynamic';

const VALID_SEGMENTS: BusinessSegment[] = [
  'LONG_TERM',
  'SHORT_TERM',
  'HOSPITALITY',
  'REALTOR',
  'INSURANCE',
];

const PUBLIC_ORIGIN = 'https://www.godmanager.us';
function billingOrigin(): string {
  return String(process.env.NEXTAUTH_URL || PUBLIC_ORIGIN).replace(/\/$/, '');
}
function localePrefix(req: NextRequest): string {
  const raw = req.cookies.get('NEXT_LOCALE')?.value?.toLowerCase() ?? '';
  if (raw === 'pt-br') return '/pt-br';
  if (raw === 'es') return '/es';
  return '/en';
}

function isSerializationConflict(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? '');
  const code = (e as { code?: string })?.code;
  return (
    code === 'P2034' ||
    msg.includes('could not serialize') ||
    msg.includes('Serialization failure') ||
    msg.includes('write conflict') ||
    msg.includes('deadlock')
  );
}
async function withSerializableRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      if (isSerializationConflict(e) && i < attempts - 1) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 40 * (i + 1)));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

/**
 * POST /api/billing/signup-checkout  (PÚBLICO — vendas automáticas self-service)
 *
 * Cria a conta em estado PENDENTE (User.status='pending' → não loga até pagar) +
 * Subscription, e devolve a URL do Stripe Checkout. Quem ativa o usuário/assinatura
 * é o webhook, no evento checkout.session.completed. Sem convite.
 */
export async function POST(req: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json({ ok: false, error: 'stripe_not_configured' }, { status: 503 });
    }

    const body = await req.json().catch(() => ({}));
    const firstName = String(body?.firstName || '').trim();
    const lastName = String(body?.lastName || '').trim() || '—';
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const companyName = String(body?.companyName || '').trim();

    if (!firstName || !email || !companyName) {
      return NextResponse.json(
        { ok: false, error: 'firstName, email e companyName sao obrigatorios.' },
        { status: 400 },
      );
    }
    if (!email.includes('@')) {
      return NextResponse.json({ ok: false, error: 'email invalido.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json(
        { ok: false, error: 'Password com pelo menos 8 caracteres.' },
        { status: 400 },
      );
    }

    const segmentRaw = String(body?.segment || 'LONG_TERM').toUpperCase().trim();
    if (!VALID_SEGMENTS.includes(segmentRaw as BusinessSegment)) {
      return NextResponse.json(
        { ok: false, error: 'invalid_segment', validSegments: VALID_SEGMENTS },
        { status: 400 },
      );
    }
    const segment = segmentRaw as BusinessSegment;
    const packageTier = body?.packageTier != null ? Number(body.packageTier) : null;
    const avgRent = body?.avgRent != null ? Number(body.avgRent) : null;
    const avgVgv = body?.avgVgv != null ? Number(body.avgVgv) : null;
    const unitCount = body?.unitCount != null ? Number(body.unitCount) : null;
    const interval: BillingInterval =
      String(body?.interval || 'MONTHLY').toUpperCase() === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY';

    const pricingInput: PricingInput = { segment, packageTier, avgRent, avgVgv, unitCount };
    const pricing = calculatePrice(pricingInput);
    if (!pricing.ok) {
      return NextResponse.json(
        { ok: false, error: 'invalid_pricing_input', detail: pricing.error },
        { status: 400 },
      );
    }
    const amountUsd = interval === 'ANNUAL' ? pricing.annualTotal : pricing.monthlyTotal;
    const amountCents = Math.round(amountUsd * 100);
    if (amountCents < 50) {
      return NextResponse.json({ ok: false, error: 'amount_too_low', amountCents }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ ok: false, error: 'Email ja existe.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const trialStartsAt = new Date();
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);

    // Conta criada PENDENTE — não loga até o webhook confirmar o pagamento.
    const { user, subscription } = await withSerializableRetry(() =>
      prisma.$transaction(
        async (tx) => {
          let client = await tx.client.findFirst({
            where: { companyName: { equals: companyName, mode: 'insensitive' } },
          });
          if (!client) {
            client = await tx.client.create({
              data: {
                companyName,
                contactName: `${firstName} ${lastName}`,
                email,
                plan: 'starter',
                accessLevel: 'admin',
                active: true,
              },
            });
          }
          const user = await tx.user.create({
            data: {
              firstName,
              lastName,
              email,
              role: 'admin',
              status: 'pending',
              permissions: [],
              passwordHash,
              clientId: client.id,
            },
          });
          const subscription = await tx.subscription.create({
            data: {
              userId: user.id,
              status: 'TRIAL',
              trialStartsAt,
              trialEndsAt,
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
          return { user, client, subscription };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5_000,
          timeout: 15_000,
        },
      ),
    );

    const customer = await stripe.customers.create({
      email,
      name: `${firstName} ${lastName}`,
      metadata: { userId: user.id, godmanagerSubId: subscription.id },
    });

    const origin = billingOrigin();
    const loc = localePrefix(req);
    const productName = `GodManager — ${segment}${packageTier ? ` P${packageTier}` : ''}`;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: productName, metadata: { segment, interval } },
            recurring: { interval: interval === 'ANNUAL' ? 'year' : 'month' },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}${loc}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${loc}/billing/cancel`,
      metadata: {
        userId: user.id,
        subscriptionId: subscription.id,
        segment,
        packageTier: String(packageTier ?? ''),
        interval,
        selfSignup: '1',
      },
    });

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { stripeCustomerId: customer.id },
    });
    await prisma.billingEvent.create({
      data: {
        subscriptionId: subscription.id,
        eventType: 'self_signup_checkout_created',
        amount: new Prisma.Decimal(amountUsd),
        metadata: { stripeSessionId: session.id, stripeCustomerId: customer.id, interval, segment },
      },
    });

    return NextResponse.json({ ok: true, url: session.url, sessionId: session.id });
  } catch (e: unknown) {
    console.error('[/api/billing/signup-checkout]', e);
    const msg = e instanceof Error ? e.message : 'internal_error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
