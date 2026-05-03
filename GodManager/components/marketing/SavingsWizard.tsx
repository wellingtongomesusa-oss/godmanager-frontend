'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useState, useMemo } from 'react';
import { calculatePrice, mapUiToSegment } from '@/lib/billingPricing';

type BusinessType = 'realtor' | 'longterm' | 'insurance' | 'pm' | 'maintenance' | 'other';
type ClientRange = '1-10' | '11-30' | '31-100' | '101-200' | '200+';
type SystemKey = 'appfolio' | 'buildium' | 'yardi' | 'rentmanager' | 'tenantcloud' | 'clickpay' | 'excel' | 'other';

const RANGE_TO_PROPERTIES: Record<ClientRange, number> = {
  '1-10': 5,
  '11-30': 20,
  '31-100': 65,
  '101-200': 150,
  '200+': 250,
};

const SYSTEM_BASE_COST: Record<SystemKey, number> = {
  appfolio: 12,
  buildium: 10,
  yardi: 15,
  rentmanager: 13,
  tenantcloud: 8,
  clickpay: 5,
  excel: 0,
  other: 7,
};

const GODMANAGER_COST_PER_PROP = 19.9;

export function SavingsWizard() {
  const t = useTranslations('savingsWizard');
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [clientRange, setClientRange] = useState<ClientRange | null>(null);
  const [systems, setSystems] = useState<SystemKey[]>([]);

  const [avgRent, setAvgRent] = useState<number>(1800);
  const [avgVgv, setAvgVgv] = useState<number>(500000);
  const [billingInterval] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [packageTier, setPackageTier] = useState<1 | 2 | 3>(1);
  const [emailRevealed, setEmailRevealed] = useState<boolean>(false);
  const [revealEmail, setRevealEmail] = useState<string>('');
  const [revealLoading, setRevealLoading] = useState<boolean>(false);
  const [revealError, setRevealError] = useState<string>('');

  const properties = clientRange ? RANGE_TO_PROPERTIES[clientRange] : 0;

  const segment = businessType ? mapUiToSegment(businessType) : null;
  const supportsPricing = segment !== null;

  const pricing = useMemo(() => {
    if (!segment || !supportsPricing) return null;
    if (segment === 'LONG_TERM') {
      return calculatePrice({
        segment,
        packageTier,
        avgRent,
        unitCount: properties,
        avgVgv: null,
      });
    }
    if (segment === 'SHORT_TERM' || segment === 'HOSPITALITY') {
      return calculatePrice({
        segment,
        packageTier: null,
        avgRent: null,
        unitCount: properties,
        avgVgv: null,
      });
    }
    if (segment === 'REALTOR' || segment === 'INSURANCE') {
      return calculatePrice({
        segment,
        packageTier: null,
        avgRent: null,
        unitCount: 1,
        avgVgv,
      });
    }
    return null;
  }, [segment, supportsPricing, packageTier, avgRent, avgVgv, properties]);

  // Heuristic: if user uses multiple systems, costs add up
  const currentMonthlyCost = useMemo(() => {
    if (!properties) return 0;
    if (!systems.length) return 0;
    const costPerProp = systems.reduce((sum, s) => sum + SYSTEM_BASE_COST[s], 0);
    return properties * costPerProp;
  }, [properties, systems]);

  const godmanagerMonthlyCost = properties * GODMANAGER_COST_PER_PROP;
  const monthlySavings = Math.max(0, currentMonthlyCost - godmanagerMonthlyCost);
  const annualSavings = monthlySavings * 12;
  const savingsPct =
    currentMonthlyCost > 0
      ? Math.round(((currentMonthlyCost - godmanagerMonthlyCost) / currentMonthlyCost) * 100)
      : 0;

  const progress = step === 1 ? 0 : step === 2 ? 33 : step === 3 ? 66 : 100;

  const handleQ1 = (val: BusinessType) => {
    setBusinessType(val);
    setTimeout(() => setStep(2), 600);
  };

  const handleQ2 = (val: ClientRange) => {
    setClientRange(val);
    setTimeout(() => setStep(3), 600);
  };

  const toggleSystem = (val: SystemKey) => {
    setSystems((prev) => (prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]));
  };

  const handleContinue = () => setStep(4);
  const handleBack = () => {
    if (step > 1) setStep((step - 1) as 1 | 2 | 3 | 4);
  };

  async function handleRevealPricing() {
    setRevealError('');
    if (!revealEmail || !/^[^@]+@[^@]+\.[^@]+$/.test(revealEmail)) {
      setRevealError('Please enter a valid email');
      return;
    }
    setRevealLoading(true);
    try {
      const resp = await fetch('/api/savings/reveal-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: revealEmail,
          businessType,
          properties,
          systems,
          segment,
          packageTier: segment === 'LONG_TERM' ? packageTier : null,
          avgRent: segment === 'LONG_TERM' ? avgRent : null,
          avgVgv: segment === 'REALTOR' || segment === 'INSURANCE' ? avgVgv : null,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        setRevealError(data.error || 'Failed to submit');
        setRevealLoading(false);
        return;
      }
      setEmailRevealed(true);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setRevealError(err?.message || 'Network error');
    } finally {
      setRevealLoading(false);
    }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  // Layout: grid 2 cols on desktop, stacked on mobile
  return (
    <div className="min-h-screen bg-[#f5f0e8] py-12 px-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="font-playfair text-4xl text-[#1e2b3d] mb-2">{t('pageTitle')}</h1>
          <p className="text-sm text-slate-600">{t('pageSubtitle')}</p>
        </div>

        {/* Progress bar */}
        <div className="mx-auto max-w-4xl mb-6">
          <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#c9a961] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {step <= 3 && (
            <p className="text-xs text-slate-500 mt-2 text-center">{t('step', { current: step, total: 3 })}</p>
          )}
        </div>

        {/* 2-column layout */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* LEFT: Wizard questions */}
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200/60">
            {step === 1 && (
              <div className="animate-fadeIn">
                <h2 className="font-playfair text-2xl text-[#1e2b3d] mb-2">{t('q1Title')}</h2>
                <p className="text-sm text-slate-500 mb-6">{t('q1Sub')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { k: 'realtor' as BusinessType, label: t('q1Realtor') },
                    { k: 'longterm' as BusinessType, label: t('q1LongTerm') },
                    { k: 'insurance' as BusinessType, label: t('q1Insurance') },
                    { k: 'pm' as BusinessType, label: t('q1PropertyManager') },
                    { k: 'maintenance' as BusinessType, label: t('q1Maintenance') },
                    { k: 'other' as BusinessType, label: t('q1Other') },
                  ].map(({ k, label }) => (
                    <button
                      key={k}
                      onClick={() => handleQ1(k)}
                      className={`p-4 rounded-lg border-2 text-left text-sm font-medium transition-all hover:border-[#1e2b3d] hover:bg-slate-50 ${
                        businessType === k
                          ? 'border-[#1e2b3d] bg-[#1e2b3d]/5 text-[#1e2b3d]'
                          : 'border-slate-200 text-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="animate-fadeIn">
                <h2 className="font-playfair text-2xl text-[#1e2b3d] mb-2">{t('q2Title')}</h2>
                <p className="text-sm text-slate-500 mb-6">{t('q2Sub')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { k: '1-10' as ClientRange, label: t('q2_1_10') },
                    { k: '11-30' as ClientRange, label: t('q2_11_30') },
                    { k: '31-100' as ClientRange, label: t('q2_31_100') },
                    { k: '101-200' as ClientRange, label: t('q2_101_200') },
                    { k: '200+' as ClientRange, label: t('q2_200plus') },
                  ].map(({ k, label }) => (
                    <button
                      key={k}
                      onClick={() => handleQ2(k)}
                      className={`p-4 rounded-lg border-2 text-left text-sm font-medium transition-all hover:border-[#1e2b3d] hover:bg-slate-50 ${
                        clientRange === k
                          ? 'border-[#1e2b3d] bg-[#1e2b3d]/5 text-[#1e2b3d]'
                          : 'border-slate-200 text-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleBack}
                  className="mt-6 text-sm text-slate-500 hover:text-[#1e2b3d]"
                >
                  ← {t('back')}
                </button>
              </div>
            )}

            {step === 3 && (
              <div className="animate-fadeIn">
                <h2 className="font-playfair text-2xl text-[#1e2b3d] mb-2">{t('q3Title')}</h2>
                <p className="text-sm text-slate-500 mb-6">{t('q3Sub')}</p>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {[
                    { k: 'appfolio' as SystemKey, label: t('q3AppFolio') },
                    { k: 'buildium' as SystemKey, label: t('q3Buildium') },
                    { k: 'yardi' as SystemKey, label: t('q3Yardi') },
                    { k: 'rentmanager' as SystemKey, label: t('q3RentManager') },
                    { k: 'tenantcloud' as SystemKey, label: t('q3TenantCloud') },
                    { k: 'clickpay' as SystemKey, label: t('q3ClickPay') },
                    { k: 'excel' as SystemKey, label: t('q3Excel') },
                    { k: 'other' as SystemKey, label: t('q3Other') },
                  ].map(({ k, label }) => {
                    const selected = systems.includes(k);
                    return (
                      <button
                        key={k}
                        onClick={() => toggleSystem(k)}
                        className={`p-3 rounded-lg border-2 text-sm font-medium transition-all hover:border-[#1e2b3d] ${
                          selected
                            ? 'border-[#1e2b3d] bg-[#1e2b3d]/5 text-[#1e2b3d]'
                            : 'border-slate-200 text-slate-700'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-between items-center">
                  <button onClick={handleBack} className="text-sm text-slate-500 hover:text-[#1e2b3d]">
                    ← {t('back')}
                  </button>
                  <button
                    onClick={handleContinue}
                    disabled={systems.length === 0}
                    className={`px-6 py-3 rounded-lg font-medium text-white transition-all ${
                      systems.length > 0
                        ? 'bg-[#c9a961] hover:bg-[#b08f4a]'
                        : 'bg-slate-300 cursor-not-allowed'
                    }`}
                  >
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="animate-fadeIn py-4">
                <div className="text-center mb-8">
                  <p className="text-sm uppercase tracking-wider text-slate-500 mb-2">{t('resultTitle')}</p>
                  <p className="font-playfair text-5xl text-[#1e2b3d] mb-3">{fmt(annualSavings)}</p>
                  <p className="text-sm text-slate-600">
                    {fmt(monthlySavings)}/mo · {savingsPct}% less than today
                  </p>
                </div>

                {!supportsPricing && (
                  <div className="text-center">
                    <p className="text-sm text-slate-600 mb-4">
                      Let us discuss the right plan for your business.
                    </p>
                    <Link
                      href="/contacto"
                      className="inline-block px-8 py-4 rounded-lg bg-[#c9a961] text-white font-semibold hover:bg-[#b08f4a] transition-all"
                    >
                      Contact us →
                    </Link>
                  </div>
                )}

                {supportsPricing && (
                  <div className="border-t border-slate-200 pt-6">
                    <p className="text-xs uppercase tracking-wider text-slate-500 mb-4 text-center">
                      Your GodManager plan
                    </p>

                    {segment === 'LONG_TERM' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                        <div>
                          <label className="text-xs text-slate-500 uppercase tracking-wider">
                            Avg monthly rent
                          </label>
                          <input
                            type="number"
                            value={avgRent}
                            onChange={(e) => setAvgRent(Math.max(0, Number(e.target.value || 0)))}
                            className="w-full mt-1 px-3 py-2 border border-slate-300 rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 uppercase tracking-wider">Package</label>
                          <div className="flex gap-1 mt-1">
                            {[1, 2, 3].map((tier) => (
                              <button
                                key={tier}
                                type="button"
                                onClick={() => setPackageTier(tier as 1 | 2 | 3)}
                                className={`flex-1 py-2 rounded text-sm font-medium ${
                                  packageTier === tier
                                    ? 'bg-[#1e2b3d] text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                P{tier}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {(segment === 'REALTOR' || segment === 'INSURANCE') && (
                      <div className="mb-4">
                        <label className="text-xs text-slate-500 uppercase tracking-wider">
                          Monthly VGV / sales volume (USD)
                        </label>
                        <input
                          type="number"
                          value={avgVgv}
                          onChange={(e) => setAvgVgv(Math.max(0, Number(e.target.value || 0)))}
                          className="w-full mt-1 px-3 py-2 border border-slate-300 rounded text-sm"
                        />
                      </div>
                    )}

                    {pricing && pricing.ok && (
                      <div className="bg-[#1e2b3d]/5 rounded-xl p-6 mb-4 text-center">
                        <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Estimated cost</p>
                        {!emailRevealed ? (
                          <>
                            <p className="font-mono text-4xl text-slate-300 mb-1">$XX.XX</p>
                            <p className="text-xs text-slate-500">per month - locked</p>
                          </>
                        ) : (
                          <>
                            <p className="font-mono text-4xl text-[#1e2b3d] mb-1">
                              {fmt(pricing.monthlyTotalDisplay)}
                            </p>
                            <p className="text-xs text-slate-600">
                              per month - {pricing.unitCount} units
                            </p>
                            {billingInterval === 'ANNUAL' && (
                              <p className="text-xs text-slate-600 mt-1">
                                or {fmt(pricing.annualTotalDisplay)} / year (2 months free)
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {!emailRevealed && pricing && pricing.ok && (
                      <div className="bg-white border border-slate-200 rounded-xl p-5">
                        <p className="text-sm text-slate-700 mb-3 text-center">
                          Enter your email to see the price for your business
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="email"
                            placeholder="you@company.com"
                            value={revealEmail}
                            onChange={(e) => setRevealEmail(e.target.value)}
                            className="flex-1 px-3 py-2 border border-slate-300 rounded text-sm"
                          />
                          <button
                            type="button"
                            onClick={handleRevealPricing}
                            disabled={revealLoading}
                            className="px-4 py-2 rounded font-medium text-white bg-[#c9a961] hover:bg-[#b08f4a] disabled:opacity-50 text-sm whitespace-nowrap"
                          >
                            {revealLoading ? 'Loading...' : 'Reveal price'}
                          </button>
                        </div>
                        {revealError && (
                          <p className="text-xs text-red-600 mt-2">{revealError}</p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-2 text-center">
                          We will only contact you about your plan.
                        </p>
                      </div>
                    )}

                    {emailRevealed && pricing && pricing.ok && (
                      <div className="text-center">
                        <Link
                          href={`/signup-trial?segment=${segment}&tier=${packageTier}&avgRent=${avgRent}&avgVgv=${avgVgv}&unitCount=${segment === 'REALTOR' || segment === 'INSURANCE' ? 1 : properties}&interval=${billingInterval}&email=${encodeURIComponent(revealEmail)}`}
                          className="inline-block px-8 py-4 rounded-lg bg-[#c9a961] text-white font-semibold hover:bg-[#b08f4a] transition-all"
                        >
                          Start 30-day free trial
                        </Link>
                        <p className="text-xs text-slate-500 mt-2">
                          No credit card required for trial
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => {
                    setStep(1);
                    setBusinessType(null);
                    setClientRange(null);
                    setSystems([]);
                    setEmailRevealed(false);
                    setRevealEmail('');
                    setRevealError('');
                    setRevealLoading(false);
                  }}
                  className="block mx-auto mt-6 text-sm text-slate-500 hover:text-[#1e2b3d]"
                >
                  ↻ Start over
                </button>
              </div>
            )}
          </div>

          {/* RIGHT: Live calculator */}
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200/60 lg:sticky lg:top-8 self-start">
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-4">{t('calcLiveLabel')}</p>

            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                <span className="text-sm text-slate-600">Properties</span>
                <span className="text-lg font-mono font-semibold text-[#1e2b3d]">{properties || '—'}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                <span className="text-sm text-slate-600">Systems</span>
                <span className="text-sm text-slate-700">
                  {systems.length > 0 ? `${systems.length} selected` : '—'}
                </span>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Today (estimated)</span>
                <span className="text-base font-mono font-semibold text-[#dc2626]">
                  {currentMonthlyCost > 0 ? `${fmt(currentMonthlyCost)}/mo` : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">With GodManager</span>
                <span className="text-base font-mono font-semibold text-[#059669]">
                  {godmanagerMonthlyCost > 0 ? `${fmt(godmanagerMonthlyCost)}/mo` : '—'}
                </span>
              </div>
            </div>

            <div className="bg-[#1e2b3d]/5 rounded-xl p-6">
              <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">You save per year</p>
              <p className="font-playfair text-4xl text-[#1e2b3d]">{annualSavings > 0 ? fmt(annualSavings) : '—'}</p>
              {savingsPct > 0 && (
                <p className="text-xs text-slate-600 mt-2">{savingsPct}% less than current setup</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}
