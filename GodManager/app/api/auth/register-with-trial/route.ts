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

/** Defaults for minimal trial signup (LONG_TERM) when client omits pricing fields. */
const TRIAL_LT_DEFAULT = {
  packageTier: 1,
  avgRent: 2500,
  unitCount: 1,
};

/**
 * POST /api/auth/register-with-trial
 *
 * Requires a valid TrialInvite token. Creates User (active) + Client + Subscription (TRIAL).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const token = String(body?.trialToken || body?.token || '').trim();
    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          error: 'token_required',
          message: 'Trial signup requires an invite token.',
        },
        { status: 403 },
      );
    }

    const invite = await prisma.trialInvite.findUnique({ where: { token } });
    if (!invite) {
      return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 404 });
    }
    if (invite.usedAt) {
      return NextResponse.json(
        {
          ok: false,
          error: 'token_used',
          message: 'Este link já foi utilizado.',
        },
        { status: 410 },
      );
    }
    if (invite.expiresAt < new Date()) {
      return NextResponse.json(
        {
          ok: false,
          error: 'token_expired',
          message: 'Este link expirou. Solicite um novo.',
        },
        { status: 410 },
      );
    }

    let firstName = String(body?.firstName || '').trim();
    let lastName = String(body?.lastName || '').trim();
    const nameRaw = String(body?.name || '').trim();
    if (nameRaw && (!firstName || !lastName)) {
      const parts = nameRaw.split(/\s+/).filter(Boolean);
      if (!firstName) firstName = parts[0] || '';
      if (!lastName)
        lastName = parts.slice(1).join(' ') || (firstName ? `${firstName} (trial)` : '');
    }
    if (!lastName.trim()) lastName = '—';

    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const companyName = String(body?.companyName || '').trim();

    if (invite.email) {
      const allowed = invite.email.trim().toLowerCase();
      if (!email || email !== allowed) {
        return NextResponse.json(
          {
            ok: false,
            error: 'email_mismatch_invite',
            message: `This invite is locked to ${invite.email}.`,
          },
          { status: 403 },
        );
      }
    }

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

    const segmentRaw = String(body?.segment || 'LONG_TERM')
      .toUpperCase()
      .trim();
    if (!VALID_SEGMENTS.includes(segmentRaw as BusinessSegment)) {
      return NextResponse.json(
        { ok: false, error: 'invalid_segment', validSegments: VALID_SEGMENTS },
        { status: 400 },
      );
    }
    const segment = segmentRaw as BusinessSegment;

    let packageTier =
      body?.packageTier != null ? Number(body.packageTier) : segment === 'LONG_TERM' ? TRIAL_LT_DEFAULT.packageTier : null;
    let avgRent = body?.avgRent != null ? Number(body.avgRent) : segment === 'LONG_TERM' ? TRIAL_LT_DEFAULT.avgRent : null;
    let unitCount =
      body?.unitCount != null ? Number(body.unitCount) : segment === 'LONG_TERM' ? TRIAL_LT_DEFAULT.unitCount : null;

    const avgVgv = body?.avgVgv != null ? Number(body.avgVgv) : null;
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

    const result = await prisma.$transaction(
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

        const marked = await tx.trialInvite.updateMany({
          where: {
            token,
            usedAt: null,
            expiresAt: { gte: new Date() },
          },
          data: {
            usedAt: new Date(),
            usedByEmail: email,
            usedByUserId: user.id,
          },
        });
        if (marked.count !== 1) {
          throw Object.assign(new Error('TOKEN_UNAVAILABLE'), {
            cause: 'concurrent_use_or_already_consumed',
          });
        }

        return { user, client, subscription };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000,
      },
    );

    return NextResponse.json({
      ok: true,
      userId: result.user.id,
      clientId: result.client.id,
      subscriptionId: result.subscription.id,
      trialEndsAt: trialEndsAt.toISOString(),
      message: 'Trial signup successful. Please log in to start.',
    });
  } catch (raw: unknown) {
    console.error('[/api/auth/register-with-trial]', raw);

    const err = raw as { cause?: unknown; message?: string };
    const isTokenUnavailable =
      (typeof raw === 'object' &&
        raw &&
        ('cause' in raw || 'message' in raw) &&
        (err.cause === 'concurrent_use_or_already_consumed' ||
          err.message?.includes('TOKEN_UNAVAILABLE'))) ||
      false;

    if (isTokenUnavailable) {
      return NextResponse.json(
        {
          ok: false,
          error: 'token_used',
          message: 'Este link já não está disponível. Gere novo convite.',
        },
        { status: 409 },
      );
    }

    const msg = raw instanceof Error ? raw.message : 'internal_error';
    const code = typeof msg === 'string' && msg.includes('\n') ? 'internal_error' : msg;

    const isSer =
      typeof msg === 'string' &&
      (msg.includes('could not serialize') || msg.includes('Serialization failure'));

    return NextResponse.json(
      {
        ok: false,
        error: isSer ? 'try_again_soon' : code,
      },
      { status: isSer ? 503 : 500 },
    );
  }
}
