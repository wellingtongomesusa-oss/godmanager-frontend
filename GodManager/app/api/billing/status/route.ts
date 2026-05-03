import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

/**
 * GET /api/billing/status
 * Subscription state for Premium HTML trial banner.
 */
export async function GET() {
  try {
    const user = await getCurrentUserFromSession();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const sub = await prisma.subscription.findUnique({
      where: { userId: user.id },
    });

    if (!sub) {
      return NextResponse.json({ ok: true, subscription: null });
    }

    return NextResponse.json({
      ok: true,
      subscription: {
        status: sub.status,
        isGrandfathered: sub.isGrandfathered,
        trialStartsAt: sub.trialStartsAt?.toISOString() ?? null,
        trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
        currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
        segment: sub.segment,
        packageTier: sub.packageTier,
        interval: sub.interval,
      },
    });
  } catch (e: unknown) {
    console.error('[/api/billing/status]', e);
    const msg = e instanceof Error ? e.message : 'internal_error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
