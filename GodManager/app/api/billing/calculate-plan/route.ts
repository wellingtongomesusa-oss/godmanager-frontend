import { NextRequest, NextResponse } from 'next/server';
import { calculatePrice, type PricingInput } from '@/lib/billingPricing';
import type { BusinessSegment } from '@prisma/client';

export const dynamic = 'force-dynamic';

const VALID_SEGMENTS: BusinessSegment[] = [
  'LONG_TERM', 'SHORT_TERM', 'HOSPITALITY', 'REALTOR', 'INSURANCE'
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Sanitize inputs
    const segmentRaw = String(body?.segment || '').toUpperCase().trim();
    if (!VALID_SEGMENTS.includes(segmentRaw as BusinessSegment)) {
      return NextResponse.json(
        { ok: false, error: 'invalid_segment', validSegments: VALID_SEGMENTS },
        { status: 400 }
      );
    }

    const input: PricingInput = {
      segment: segmentRaw as BusinessSegment,
      packageTier: body?.packageTier != null ? Number(body.packageTier) : null,
      avgRent: body?.avgRent != null ? Number(body.avgRent) : null,
      avgVgv: body?.avgVgv != null ? Number(body.avgVgv) : null,
      unitCount: body?.unitCount != null ? Number(body.unitCount) : null,
    };

    const result = calculatePrice(input);

    return NextResponse.json({
      ok: result.ok,
      input,
      pricing: result,
      annualNote: '2 months free (pay 10, get 12)',
    });
  } catch (e: any) {
    console.error('[/api/billing/calculate-plan]', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'internal_error' },
      { status: 500 }
    );
  }
}
