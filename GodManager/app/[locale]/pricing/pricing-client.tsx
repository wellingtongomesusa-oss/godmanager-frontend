'use client';

import { useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import type { BusinessSegment } from '@prisma/client';
import { calculatePrice } from '@/lib/billingPricing';
import { SiteHeader } from '@/components/landing/SiteHeader';

type Segment = BusinessSegment;
type Interval = 'MONTHLY' | 'ANNUAL';

const SEGMENTS: Segment[] = [
  'LONG_TERM',
  'SHORT_TERM',
  'HOSPITALITY',
  'REALTOR',
  'INSURANCE',
];

function segmentTitleKey(seg: Segment): string {
  const m: Record<Segment, string> = {
    LONG_TERM: 'segLongTermLabel',
    SHORT_TERM: 'segShortTermLabel',
    HOSPITALITY: 'segHospitalityLabel',
    REALTOR: 'segRealtorLabel',
    INSURANCE: 'segInsuranceLabel',
  };
  return m[seg];
}

function segmentDescKey(seg: Segment): string {
  const m: Record<Segment, string> = {
    LONG_TERM: 'segLongTermDesc',
    SHORT_TERM: 'segShortTermDesc',
    HOSPITALITY: 'segHospitalityDesc',
    REALTOR: 'segRealtorDesc',
    INSURANCE: 'segInsuranceDesc',
  };
  return m[seg];
}

function computeTotals(
  segment: Segment,
  packageTier: number,
  avgRent: number,
  avgVgv: number,
  unitCount: number,
): { ppu: number; monthly: number; annual: number } {
  const r = calculatePrice({
    segment,
    packageTier: segment === 'LONG_TERM' ? packageTier : null,
    avgRent: segment === 'LONG_TERM' ? avgRent : null,
    avgVgv: segment === 'REALTOR' || segment === 'INSURANCE' ? avgVgv : null,
    unitCount,
  });
  if (!r.ok) return { ppu: 0, monthly: 0, annual: 0 };
  return { ppu: r.pricePerUnit, monthly: r.monthlyTotal, annual: r.annualTotal };
}

const fmt = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PricingClient() {
  const t = useTranslations('pricing');

  const [segment, setSegment] = useState<Segment>('LONG_TERM');
  const [packageTier, setPackageTier] = useState<number>(1);
  const [avgRent, setAvgRent] = useState<number>(1800);
  const [avgVgv, setAvgVgv] = useState<number>(500000);
  const [unitCount, setUnitCount] = useState<number>(20);
  const [interval, setInterval] = useState<Interval>('MONTHLY');

  const isLT = segment === 'LONG_TERM';
  const isVgvBased = segment === 'REALTOR' || segment === 'INSURANCE';

  const ltPackages = useMemo(() => {
    return [1, 2, 3].map((tier) => ({
      tier,
      ...computeTotals('LONG_TERM', tier, avgRent, 0, unitCount),
    }));
  }, [avgRent, unitCount]);

  const current = useMemo(
    () => computeTotals(segment, packageTier, avgRent, avgVgv, unitCount),
    [segment, packageTier, avgRent, avgVgv, unitCount],
  );

  const displayPrice = interval === 'ANNUAL' ? current.annual : current.monthly;

  const registerHref = useMemo(() => {
    const q = new URLSearchParams({
      segment,
      tier: String(packageTier),
      avgRent: String(avgRent),
      avgVgv: String(avgVgv),
      unitCount: String(unitCount),
      interval,
    });
    return `/signup-trial?${q.toString()}`;
  }, [segment, packageTier, avgRent, avgVgv, unitCount, interval]);

  const ink = 'var(--ink)';
  const ink2 = 'var(--ink2)';
  const ink3 = 'var(--ink3)';
  const border = 'var(--border)';
  const blue = 'var(--blue)';
  const blueBg = 'var(--blue-bg)';
  const amber = 'var(--amber)';
  const sand = 'var(--sand)';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: sand,
        color: ink,
        fontFamily: 'var(--font-body)',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      <SiteHeader active="pricing" />
      <main
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '96px 24px 48px',
        }}
      >
        <header style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 36,
              fontWeight: 600,
              color: ink,
              marginBottom: 12,
              letterSpacing: '-0.02em',
            }}
          >
            {t('title')}
          </h1>
          <p style={{ fontSize: 15, color: ink2, maxWidth: 560, margin: '0 auto', lineHeight: 1.55 }}>
            {t('subtitle')}
          </p>
        </header>

        <section style={{ marginBottom: 32 }}>
          <h2
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: ink3,
              marginBottom: 12,
            }}
          >
            {t('step1')}
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
            }}
          >
            {SEGMENTS.map((seg) => (
              <button
                key={seg}
                type="button"
                onClick={() => {
                  setSegment(seg);
                  setPackageTier(1);
                }}
                style={{
                  padding: 16,
                  border:
                    segment === seg ? `2px solid ${amber}` : `1px solid ${border}`,
                  borderRadius: 12,
                  background: segment === seg ? 'var(--amber-bg)' : 'var(--paper)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  boxShadow:
                    segment === seg ? '0 4px 16px rgba(201,169,110,.12)' : 'none',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600 }}>{t(segmentTitleKey(seg))}</div>
                <div style={{ fontSize: 12, color: ink2, marginTop: 6, lineHeight: 1.45 }}>
                  {t(segmentDescKey(seg))}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section
          style={{
            marginBottom: 32,
            padding: 22,
            background: 'var(--cream)',
            borderRadius: 12,
            border: `1px solid ${border}`,
          }}
        >
          <h2
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: ink3,
              marginBottom: 14,
            }}
          >
            {t('step2')}
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
            }}
          >
            {isLT && (
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: ink3, letterSpacing: '0.04em' }}>
                  {t('avgRent')}
                </label>
                <input
                  type="number"
                  value={avgRent}
                  onChange={(e) => setAvgRent(Math.max(0, Number(e.target.value || 0)))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: `1px solid var(--border2)`,
                    borderRadius: 8,
                    fontSize: 14,
                    marginTop: 6,
                    background: 'var(--sand)',
                    color: ink,
                    fontFamily: 'var(--font-body)',
                  }}
                />
              </div>
            )}
            {isVgvBased && (
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: ink3, letterSpacing: '0.04em' }}>
                  {t('avgVgv')}
                </label>
                <input
                  type="number"
                  value={avgVgv}
                  onChange={(e) => setAvgVgv(Math.max(0, Number(e.target.value || 0)))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: `1px solid var(--border2)`,
                    borderRadius: 8,
                    fontSize: 14,
                    marginTop: 6,
                    background: 'var(--sand)',
                    color: ink,
                    fontFamily: 'var(--font-body)',
                  }}
                />
              </div>
            )}
            {!isVgvBased && (
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: ink3, letterSpacing: '0.04em' }}>
                  {t('unitCount')}
                </label>
                <input
                  type="number"
                  value={unitCount}
                  onChange={(e) => setUnitCount(Math.max(1, Number(e.target.value || 1)))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: `1px solid var(--border2)`,
                    borderRadius: 8,
                    fontSize: 14,
                    marginTop: 6,
                    background: 'var(--sand)',
                    color: ink,
                    fontFamily: 'var(--font-body)',
                  }}
                />
              </div>
            )}
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: ink3, letterSpacing: '0.04em' }}>
                {t('billingInterval')}
              </label>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setInterval('MONTHLY')}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    border:
                      interval === 'MONTHLY' ? `2px solid ${amber}` : `1px solid ${border}`,
                    borderRadius: 8,
                    background: interval === 'MONTHLY' ? 'var(--amber-bg)' : 'var(--paper)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: ink,
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {t('monthly')}
                </button>
                <button
                  type="button"
                  onClick={() => setInterval('ANNUAL')}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    border:
                      interval === 'ANNUAL' ? `2px solid ${amber}` : `1px solid ${border}`,
                    borderRadius: 8,
                    background: interval === 'ANNUAL' ? 'var(--amber-bg)' : 'var(--paper)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: ink,
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {t('annual')}{' '}
                  <span style={{ color: 'var(--green)', fontSize: 10, fontWeight: 600 }}>
                    {t('annualBadge')}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {isLT && (
          <section style={{ marginBottom: 32 }}>
            <h2
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: ink3,
                marginBottom: 12,
              }}
            >
              {t('step3')}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {ltPackages.map((pkg) => (
                <button
                  key={pkg.tier}
                  type="button"
                  onClick={() => setPackageTier(pkg.tier)}
                  style={{
                    padding: 22,
                    border:
                      packageTier === pkg.tier ? `2px solid ${amber}` : `1px solid ${border}`,
                    borderRadius: 12,
                    background: packageTier === pkg.tier ? blueBg : 'var(--paper)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'box-shadow 0.15s',
                    boxShadow:
                      packageTier === pkg.tier ? '0 4px 14px rgba(34,85,140,.1)' : 'none',
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: ink3,
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                    }}
                  >
                    {t('pkgN', { tier: pkg.tier })}
                  </div>
                  <div
                    style={{
                      fontSize: 26,
                      fontWeight: 700,
                      color: blue,
                      marginTop: 10,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {fmt(pkg.ppu)}
                  </div>
                  <div style={{ fontSize: 11, color: ink2, marginTop: 4 }}>{t('perUnitMonth')}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 12, color: ink }}>
                    {fmt(interval === 'ANNUAL' ? pkg.annual : pkg.monthly)}{' '}
                    {interval === 'ANNUAL' ? t('pkgYr') : t('pkgMo')}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        <section
          style={{
            padding: 26,
            background: blue,
            color: '#fff',
            borderRadius: 12,
            marginBottom: 28,
            textAlign: 'center',
            boxShadow: '0 8px 28px rgba(34,85,140,.2)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              opacity: 0.88,
            }}
          >
            {t('estimatedCost')}
          </div>
          <div
            style={{
              fontSize: 40,
              fontWeight: 700,
              marginTop: 10,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '-0.02em',
            }}
          >
            {fmt(displayPrice)}
          </div>
          <div style={{ fontSize: 14, opacity: 0.9, marginTop: 8 }}>
            {t('per')} {interval === 'ANNUAL' ? t('perYear') : t('perMonth')} ·{' '}
            {!isVgvBased ? t('unitsSummary', { count: unitCount }) : t('singleSub')}
          </div>
        </section>

        <div style={{ textAlign: 'center' }}>
          <Link
            href={registerHref}
            style={{
              display: 'inline-block',
              padding: '14px 32px',
              background: amber,
              color: '#fff',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 14,
              letterSpacing: '0.02em',
              boxShadow: '0 2px 8px rgba(201,169,110,.25)',
            }}
          >
            {t('startTrial')}
          </Link>
          <div style={{ fontSize: 12, color: ink2, marginTop: 14, maxWidth: 420, marginInline: 'auto' }}>
            {t('trialNote')}
          </div>
        </div>
      </main>
    </div>
  );
}
