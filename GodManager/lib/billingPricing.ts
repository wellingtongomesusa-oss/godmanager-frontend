import { BusinessSegment } from '@prisma/client';

/**
 * Pricing model for GodManager subscription tiers.
 *
 * Long Term has 3 packages calculated against the customer's
 * average rent per unit. Other segments have a single tier.
 *
 * Long Term P1: max(rent x 0.88%, 15) per unit
 * Long Term P2: P1 + max(rent x 0.50%, 4) per unit
 * Long Term P3: max(P2 + rent x 0.25%, 25) per unit
 * Short Term:   18.90 per unit
 * Hospitality:  18.90 per unit
 * Realtor:      VGV monthly x 0.88% (single subscription, unitCount = 1)
 * Insurance:    VGV monthly x 0.88% (single subscription, unitCount = 1)
 *
 * Annual billing: 2 months free (pay 10, get 12)
 *   → annual price = monthly x 10
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

export type PricingInput = {
  segment: BusinessSegment;
  packageTier?: number | null; // 1, 2, 3 — only for LONG_TERM
  avgRent?: number | null; // monthly rent average per unit (LT)
  avgVgv?: number | null; // monthly VGV (REALTOR / INSURANCE)
  unitCount?: number | null; // for per-unit segments
};

export type PricingResult = {
  pricePerUnit: number; // for per-unit segments
  unitCount: number; // resolved
  monthlyTotal: number; // total monthly USD
  annualTotal: number; // monthly x 10 (2 months free)
  breakdown: {
    base?: number;
    p2Add?: number;
    p3Add?: number;
    appliedMin?: number;
  };
  ok: boolean;
  error?: string;
};

export function calculatePrice(input: PricingInput): PricingResult {
  const { segment, packageTier, avgRent, avgVgv, unitCount } = input;

  // SHORT_TERM and HOSPITALITY: $18.90 per unit, single tier
  if (segment === 'SHORT_TERM' || segment === 'HOSPITALITY') {
    const units = Math.max(0, Math.floor(Number(unitCount || 0)));
    if (units < 1) {
      return zeroResult({ ok: false, error: 'unitCount must be >= 1' });
    }
    const ppu = 18.9;
    const monthly = round2(ppu * units);
    return {
      pricePerUnit: ppu,
      unitCount: units,
      monthlyTotal: monthly,
      annualTotal: round2(monthly * 10),
      breakdown: { base: ppu },
      ok: true,
    };
  }

  // REALTOR and INSURANCE: VGV monthly x 0.88%, single subscription
  if (segment === 'REALTOR' || segment === 'INSURANCE') {
    const vgv = Math.max(0, Number(avgVgv || 0));
    if (vgv <= 0) {
      return zeroResult({ ok: false, error: 'avgVgv must be > 0' });
    }
    const monthly = round2(vgv * 0.0088);
    return {
      pricePerUnit: monthly,
      unitCount: 1,
      monthlyTotal: monthly,
      annualTotal: round2(monthly * 10),
      breakdown: { base: monthly },
      ok: true,
    };
  }

  // LONG_TERM: 3 packages
  if (segment === 'LONG_TERM') {
    const tier = Number(packageTier || 0);
    if (![1, 2, 3].includes(tier)) {
      return zeroResult({ ok: false, error: 'packageTier must be 1, 2 or 3' });
    }
    const rent = Math.max(0, Number(avgRent || 0));
    if (rent <= 0) {
      return zeroResult({ ok: false, error: 'avgRent must be > 0' });
    }
    const units = Math.max(0, Math.floor(Number(unitCount || 0)));
    if (units < 1) {
      return zeroResult({ ok: false, error: 'unitCount must be >= 1' });
    }

    // P1
    const p1Calc = rent * 0.0088;
    const p1 = Math.max(p1Calc, 15);

    // P2
    const p2Add = Math.max(rent * 0.005, 4);
    const p2 = p1 + p2Add;

    // P3 (note: minimum 25 applies to TOTAL price per unit, not just to delta)
    const p3Calc = p2 + rent * 0.0025;
    const p3 = Math.max(p3Calc, 25);

    let ppu = 0;
    let appliedMin = 0;
    const breakdown: PricingResult['breakdown'] = {};

    if (tier === 1) {
      ppu = p1;
      breakdown.base = round2(p1Calc);
      if (p1Calc < 15) appliedMin = 15;
    } else if (tier === 2) {
      ppu = p2;
      breakdown.base = round2(p1Calc);
      breakdown.p2Add = round2(rent * 0.005);
      if (p1Calc < 15 || rent * 0.005 < 4) appliedMin = 1; // marker
    } else {
      ppu = p3;
      breakdown.base = round2(p1Calc);
      breakdown.p2Add = round2(rent * 0.005);
      breakdown.p3Add = round2(rent * 0.0025);
      if (p3Calc < 25) appliedMin = 25;
    }

    ppu = round2(ppu);
    const monthly = round2(ppu * units);

    return {
      pricePerUnit: ppu,
      unitCount: units,
      monthlyTotal: monthly,
      annualTotal: round2(monthly * 10),
      breakdown,
      ok: true,
    };
  }

  return zeroResult({ ok: false, error: 'unsupported segment' });
}

function zeroResult(opts: { ok: boolean; error?: string }): PricingResult {
  return {
    pricePerUnit: 0,
    unitCount: 0,
    monthlyTotal: 0,
    annualTotal: 0,
    breakdown: {},
    ...opts,
  };
}
