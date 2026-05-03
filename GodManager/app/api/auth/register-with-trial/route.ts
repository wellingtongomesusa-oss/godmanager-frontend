import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
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

/**
 * POST /api/auth/register-with-trial
 *
 * Creates User (active) + Client + Subscription (TRIAL). Separate from
 * POST /api/auth/register — that flow stays pending + no subscription.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const firstName = String(body?.firstName || '').trim();
    const lastName = String(body?.lastName || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const companyName = String(body?.companyName || '').trim();

    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { ok: false, error: 'firstName, lastName e email sao obrigatorios.' },
        { status: 400 },
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { ok: false, error: 'Password com pelo menos 8 caracteres.' },
        { status: 400 },
      );
    }
    if (!companyName) {
      return NextResponse.json(
        { ok: false, error: 'companyName obrigatorio para signup com trial.' },
        { status: 400 },
      );
    }

    const segmentRaw = String(body?.segment || '')
      .toUpperCase()
      .trim();
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
    const intervalRaw = String(body?.interval || 'MONTHLY').toUpperCase();
    const interval: BillingInterval = intervalRaw === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY';

    const pricingInput: PricingInput = { segment, packageTier, avgRent, avgVgv, unitCount };
    const pricing = calculatePrice(pricingInput);
    if (!pricing.ok) {
      return NextResponse.json(
        { ok: false, error: 'invalid_pricing_input', detail: pricing.error },
        { status: 400 },
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ ok: false, error: 'Email ja existe.' }, { status: 409 });
    }

    const trialStartsAt = new Date();
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);

    const result = await prisma.$transaction(async (tx) => {
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
          status: 'active',
          permissions: [],
          passwordHash: hashPassword(password),
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

      await tx.billingEvent.create({
        data: {
          subscriptionId: subscription.id,
          eventType: 'trial_started',
          amount: new Prisma.Decimal(pricing.monthlyTotal),
          metadata: {
            segment,
            packageTier,
            interval,
            unitCount,
            avgRent,
            avgVgv,
          },
        },
      });

      return { user, client, subscription };
    });

    return NextResponse.json({
      ok: true,
      userId: result.user.id,
      clientId: result.client.id,
      subscriptionId: result.subscription.id,
      trialEndsAt: trialEndsAt.toISOString(),
      message: 'Trial signup successful. Please log in to start.',
    });
  } catch (e: unknown) {
    console.error('[/api/auth/register-with-trial]', e);
    const msg = e instanceof Error ? e.message : 'internal_error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
