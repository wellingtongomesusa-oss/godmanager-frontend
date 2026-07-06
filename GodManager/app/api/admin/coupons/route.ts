import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { stripe, isStripeConfigured } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

async function requireSuperAdmin() {
  const user = await getCurrentUserFromSession();
  if (!user) return { error: 'Unauthorized', status: 401 as const, user: null };
  if (user.role !== 'super_admin') return { error: 'Forbidden', status: 403 as const, user: null };
  return { error: null, status: 200 as const, user };
}

/** Lista os cupons com métricas básicas (usos, desconto total dado). */
export async function GET() {
  const gate = await requireSuperAdmin();
  if (gate.error) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

  try {
    const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
    const agg = await prisma.couponRedemption.groupBy({
      by: ['couponId'],
      _count: { _all: true },
      _sum: { discountCents: true },
    });
    const byId = new Map(agg.map((a) => [a.couponId, a]));
    const rows = coupons.map((c) => {
      const a = byId.get(c.id);
      return {
        ...c,
        redemptionCount: a?._count._all ?? 0,
        discountGivenCents: a?._sum.discountCents ?? 0,
      };
    });
    return NextResponse.json({ ok: true, coupons: rows });
  } catch (e) {
    console.error('[GET /api/admin/coupons]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}

/** Cria um cupom: cria no Stripe (coupon + promotion code) e grava o espelho local. */
export async function POST(req: Request) {
  const gate = await requireSuperAdmin();
  if (gate.error) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  if (!isStripeConfigured()) {
    return NextResponse.json({ ok: false, error: 'stripe_not_configured' }, { status: 503 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const code = String(body?.code || '').trim().toUpperCase().replace(/\s+/g, '');
    const name = body?.name ? String(body.name).trim() : null;
    const discountType = String(body?.discountType || '').toUpperCase();
    const value = Number(body?.value);
    const duration = ['once', 'forever', 'repeating'].includes(String(body?.duration))
      ? String(body.duration)
      : 'once';
    const durationInMonths =
      duration === 'repeating' && Number.isFinite(Number(body?.durationInMonths))
        ? Math.max(1, Math.floor(Number(body.durationInMonths)))
        : null;
    const maxRedemptions =
      body?.maxRedemptions != null && Number.isFinite(Number(body.maxRedemptions))
        ? Math.max(1, Math.floor(Number(body.maxRedemptions)))
        : null;

    if (!code || !/^[A-Z0-9_-]{3,40}$/.test(code)) {
      return NextResponse.json({ ok: false, error: 'Código inválido (3-40, A-Z 0-9 _ -).' }, { status: 400 });
    }
    if (discountType !== 'PERCENT' && discountType !== 'FIXED') {
      return NextResponse.json({ ok: false, error: 'discountType deve ser PERCENT ou FIXED.' }, { status: 400 });
    }
    if (!Number.isFinite(value) || value <= 0) {
      return NextResponse.json({ ok: false, error: 'Valor inválido.' }, { status: 400 });
    }
    if (discountType === 'PERCENT' && value > 100) {
      return NextResponse.json({ ok: false, error: 'Percentual máximo é 100.' }, { status: 400 });
    }

    const existing = await prisma.coupon.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ ok: false, error: 'Já existe um cupom com esse código.' }, { status: 409 });
    }

    const amountOffCents = discountType === 'FIXED' ? Math.round(value * 100) : null;

    // Cupom no Stripe (a mecânica do desconto). O código digitado pelo cliente é
    // mapeado por nós para este stripeCouponId e aplicado via `discounts` no checkout.
    const stripeCoupon = await stripe.coupons.create({
      name: name || code,
      duration: duration as 'once' | 'forever' | 'repeating',
      ...(durationInMonths ? { duration_in_months: durationInMonths } : {}),
      ...(maxRedemptions ? { max_redemptions: maxRedemptions } : {}),
      ...(discountType === 'PERCENT'
        ? { percent_off: value }
        : { amount_off: amountOffCents as number, currency: 'usd' }),
    });

    const created = await prisma.coupon.create({
      data: {
        code,
        name,
        discountType,
        percentOff: discountType === 'PERCENT' ? value : null,
        amountOffCents,
        currency: 'USD',
        duration,
        durationInMonths,
        maxRedemptions,
        active: true,
        stripeCouponId: stripeCoupon.id,
        createdByUserId: gate.user!.id,
      },
    });

    return NextResponse.json({ ok: true, coupon: created });
  } catch (e: unknown) {
    console.error('[POST /api/admin/coupons]', e);
    const msg = e instanceof Error ? e.message : 'internal_error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
