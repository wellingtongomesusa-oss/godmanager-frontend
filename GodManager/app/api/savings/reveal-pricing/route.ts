import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculatePrice, mapUiToSegment } from '@/lib/billingPricing';
import type { BusinessSegment } from '@prisma/client';

export const dynamic = 'force-dynamic';

const VALID_BUSINESS_TYPES = [
  'realtor',
  'longterm',
  'pm',
  'insurance',
  'short_term',
  'hospitality',
  'maintenance',
  'other',
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const email = String(body?.email || '')
      .trim()
      .toLowerCase();
    const businessType = String(body?.businessType || '').trim();
    const properties = body?.properties != null ? Number(body.properties) : null;
    const systems = Array.isArray(body?.systems) ? body.systems.map(String) : [];
    const packageTier = body?.packageTier != null ? Number(body.packageTier) : null;
    const avgRent = body?.avgRent != null ? Number(body.avgRent) : null;
    const avgVgv = body?.avgVgv != null ? Number(body.avgVgv) : null;

    // Email validation
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 });
    }

    // Business type validation
    if (!VALID_BUSINESS_TYPES.includes(businessType)) {
      return NextResponse.json({ ok: false, error: 'invalid_business_type' }, { status: 400 });
    }

    // Segment may be null for maintenance/other — those don't get pricing
    const segment = mapUiToSegment(businessType);

    let pricing = null;
    if (segment) {
      const unitCount =
        segment === 'REALTOR' || segment === 'INSURANCE' ? 1 : properties ?? 1;
      pricing = calculatePrice({
        segment: segment as BusinessSegment,
        packageTier: segment === 'LONG_TERM' ? packageTier : null,
        avgRent: segment === 'LONG_TERM' ? avgRent : null,
        avgVgv: segment === 'REALTOR' || segment === 'INSURANCE' ? avgVgv : null,
        unitCount,
      });
    }

    // Capture metadata for analytics / fraud detection
    const ipAddress =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      null;
    const userAgent = req.headers.get('user-agent') || null;

    // Persist lead (best-effort — failure here should not block reveal)
    try {
      await prisma.pricingLead.create({
        data: {
          email,
          businessType,
          segment: segment ?? null,
          packageTier,
          avgRent,
          avgVgv,
          unitCount: pricing?.unitCount ?? null,
          properties,
          systems,
          pricePerUnit: pricing?.pricePerUnit ?? null,
          monthlyTotal: pricing?.monthlyTotal ?? null,
          annualTotal: pricing?.annualTotal ?? null,
          source: 'savings_wizard',
          ipAddress,
          userAgent,
        },
      });
    } catch (e) {
      console.error('[reveal-pricing] persist failed', e);
      // continue — pricing still returned
    }

    return NextResponse.json({
      ok: true,
      pricing:
        pricing && pricing.ok
          ? {
              pricePerUnit: pricing.pricePerUnit,
              pricePerUnitDisplay: pricing.pricePerUnitDisplay,
              monthlyTotal: pricing.monthlyTotal,
              monthlyTotalDisplay: pricing.monthlyTotalDisplay,
              annualTotal: pricing.annualTotal,
              annualTotalDisplay: pricing.annualTotalDisplay,
              unitCount: pricing.unitCount,
            }
          : null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'internal_error';
    console.error('[reveal-pricing]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
