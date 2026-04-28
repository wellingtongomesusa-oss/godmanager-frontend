'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

const SESSION_KEY = 'gm_calc_email_dismissed';

type SoftwareKey = 'appfolio' | 'buildium' | 'excel' | 'other' | 'none';

const DEFAULT_SOFTWARE: Record<SoftwareKey, number> = {
  appfolio: 475,
  buildium: 232,
  excel: 0,
  other: 200,
  none: 0,
};

const GM_PRICE_PER_PROPERTY = 19.9;
const ANNUAL_SAVINGS_HIGHLIGHT_USD = 30_000;

function formatMoney(n: number): string {
  const abs = Math.abs(Math.round(n));
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(abs);
}

/** USD with up to 2 decimals (for per-property × count). */
function formatMoneyPrecise(n: number): string {
  const v = Math.round(Math.abs(n) * 100) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(v);
}

function formatAnnualUsd(n: number): string {
  return formatMoney(Math.round(Math.abs(n)));
}

export function SavingsCalculator() {
  const t = useTranslations('savingsCalculator');
  const [properties, setProperties] = useState(50);
  const [software, setSoftware] = useState<SoftwareKey>('appfolio');
  const [overrideSoftware, setOverrideSoftware] = useState('');
  const [bookkeeper, setBookkeeper] = useState(true);
  const [salaryAnnual, setSalaryAnnual] = useState(54_000);
  const [auditor, setAuditor] = useState(true);
  const [auditorAnnual, setAuditorAnnual] = useState(5000);
  const [monthlyAudit, setMonthlyAudit] = useState(false);
  const [monthlyAuditCostMonthly, setMonthlyAuditCostMonthly] = useState(2500);
  const [eo, setEo] = useState(true);
  const [eoAnnual, setEoAnnual] = useState(3500);
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const defaultSoft = DEFAULT_SOFTWARE[software];
  const softwareMensal = (() => {
    const trimmed = overrideSoftware.trim();
    if (trimmed === '') return defaultSoft;
    const n = Number.parseFloat(trimmed.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? Math.max(0, n) : defaultSoft;
  })();

  const bookkeeperMensal = bookkeeper ? (salaryAnnual / 12) * 1.3 : 0;
  const auditorMensal = auditor ? auditorAnnual / 12 : 0;
  const auditoriaMensalExterna = monthlyAudit ? monthlyAuditCostMonthly : 0;
  const seguroMensal = eo ? eoAnnual / 12 : 0;
  const custoAtualMensal =
    softwareMensal + bookkeeperMensal + auditorMensal + auditoriaMensalExterna + seguroMensal;
  const custoAtualAnual = custoAtualMensal * 12;
  const godmanagerMensal = Math.round(properties * GM_PRICE_PER_PROPERTY * 100) / 100;
  const godmanagerAnual = godmanagerMensal * 12;
  const poupancaMensal = custoAtualMensal - godmanagerMensal;
  const poupancaAnual = custoAtualAnual - godmanagerAnual;

  const descontoPct =
    custoAtualAnual > 0 ? Math.round((poupancaAnual / custoAtualAnual) * 100) : 0;
  const showPositive = poupancaAnual >= 0;

  const ctaKey: 'ctaHigh' | 'ctaNormal' | 'ctaConsultor' = !showPositive
    ? 'ctaConsultor'
    : poupancaAnual > ANNUAL_SAVINGS_HIGHLIGHT_USD
      ? 'ctaHigh'
      : 'ctaNormal';

  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    if (sessionStorage.getItem(SESSION_KEY) === '1') return;
    timerRef.current = setTimeout(() => setEmailOpen(true), 30_000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const closeEmail = useCallback(() => {
    setEmailOpen(false);
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* ignore */
    }
  }, []);

  const sendEmail = useCallback(async () => {
    const em = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@]+$/.test(em)) return;
    try {
      await fetch('/api/leads/calculator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: em,
          properties,
          currentSoftware: software,
          savings: poupancaMensal,
        }),
      });
    } catch {
      /* still close */
    }
    setEmail('');
    closeEmail();
  }, [email, properties, software, poupancaMensal, closeEmail]);

  const swatches: { key: SoftwareKey; label: string }[] = [
    { key: 'appfolio', label: t('software.appfolio') },
    { key: 'buildium', label: t('software.buildium') },
    { key: 'excel', label: t('software.excel') },
    { key: 'other', label: t('software.other') },
    { key: 'none', label: t('software.none') },
  ];

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
          gap: 32,
          alignItems: 'flex-start',
        }}
        className="gm-savings-grid"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 8 }}>
              {t('properties')} · {properties}
            </label>
            <input
              type="range"
              min={1}
              max={500}
              step={5}
              value={properties}
              onChange={(e) => {
                setProperties(Number(e.target.value));
              }}
              style={{ width: '100%', accentColor: '#2d7252' }}
            />
          </div>

          <div>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 8 }}>
              {t('currentSoftware')}
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {swatches.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSoftware(key);
                    setOverrideSoftware('');
                  }}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: software === key ? '2px solid #2d7252' : '1px solid #e5e7eb',
                    background: software === key ? 'rgba(45,114,82,0.08)' : '#fff',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#374151',
                    fontFamily: 'var(--font-inter, "DM Sans"), sans-serif',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>
              {t('softwareCostOverride')}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={overrideSoftware}
              onChange={(e) => {
                setOverrideSoftware(e.target.value);
              }}
              placeholder={String(defaultSoft)}
              style={{
                width: '100%',
                maxWidth: 200,
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                fontSize: 14,
                fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
              }}
            />
          </div>

          <ToggleRow
            label={t('bookkeeperToggle')}
            on={bookkeeper}
            setOn={setBookkeeper}
            onLabel={t('toggleOn')}
            offLabel={t('toggleOff')}
          />
          {bookkeeper && (
            <MoneyInput label={t('salaryAnnual')} value={salaryAnnual} setValue={setSalaryAnnual} />
          )}

          <ToggleRow
            label={t('auditorToggle')}
            on={auditor}
            setOn={setAuditor}
            onLabel={t('toggleOn')}
            offLabel={t('toggleOff')}
          />
          {auditor && (
            <MoneyInput label={t('auditorAnnual')} value={auditorAnnual} setValue={setAuditorAnnual} />
          )}

          <ToggleRow
            label={t('auditMonthlyToggle')}
            on={monthlyAudit}
            setOn={setMonthlyAudit}
            onLabel={t('toggleOn')}
            offLabel={t('toggleOff')}
          />
          {monthlyAudit && (
            <div>
              <MoneyInput
                label={t('auditMonthlyCost')}
                value={monthlyAuditCostMonthly}
                setValue={setMonthlyAuditCostMonthly}
              />
              <p style={{ fontSize: 11, color: '#9ca3af', margin: '6px 0 0', lineHeight: 1.45 }}>
                {t('auditMonthlyHelp')}
              </p>
            </div>
          )}

          <ToggleRow
            label={t('eoToggle')}
            on={eo}
            setOn={setEo}
            onLabel={t('toggleOn')}
            offLabel={t('toggleOff')}
          />
          {eo && <MoneyInput label={t('eoAnnual')} value={eoAnnual} setValue={setEoAnnual} />}
        </div>

        <div
          style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 24,
            position: 'sticky',
            top: 100,
            boxShadow: '0 4px 20px rgba(15,23,42,0.06)',
          }}
        >
          <style>{`
            .gm-save-hero-num {
              font-size: 72px;
              line-height: 1.05;
              font-weight: 600;
              letter-spacing: -1px;
              margin: 0;
              font-family: var(--font-playfair, "Cormorant Garamond"), Georgia, serif;
            }
            @media (max-width: 640px) {
              .gm-save-hero-num {
                font-size: 48px;
              }
            }
          `}</style>

          <section
            style={{
              marginBottom: 24,
              padding: 32,
              borderRadius: 12,
              border: !showPositive
                ? '1px solid rgba(217,119,6,0.35)'
                : '1px solid rgba(45,114,82,0.22)',
              background: !showPositive ? 'rgba(251,191,36,0.12)' : 'rgba(45,114,82,0.08)',
              animation: 'gmFadeHero 0.35s ease',
            }}
          >
            <style>{`@keyframes gmFadeHero { from { opacity: 0.92 } to { opacity: 1 } }`}</style>
            {!showPositive ? (
              <>
                <p style={{ margin: '0 0 8px', fontSize: 11, letterSpacing: '0.08em', fontWeight: 600, textTransform: 'uppercase', color: '#92400e' }}>
                  {t('annualGapNegative')}
                </p>
                <p className="gm-save-hero-num" style={{ color: '#92400e' }}>
                  {formatAnnualUsd(-poupancaAnual)}
                </p>
                <p style={{ marginTop: 16, fontSize: 13, color: '#57534e', lineHeight: 1.65 }}>
                  {t('worthItExplanation')}
                </p>
              </>
            ) : (
              <>
                <p style={{ margin: '0 0 8px', fontSize: 11, letterSpacing: '0.08em', fontWeight: 600, textTransform: 'uppercase', color: '#6b7280' }}>
                  {t('youSaveAnually')}
                </p>
                <p className="gm-save-hero-num" style={{ color: 'var(--green, #2d7252)' }}>
                  {formatAnnualUsd(poupancaAnual)}
                </p>
                {showPositive && custoAtualAnual > 0 && (
                  <div
                    role="presentation"
                    style={{
                      marginTop: 16,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'var(--green, #2d7252)',
                      color: '#fff',
                      padding: '6px 14px',
                      borderRadius: 999,
                      fontSize: 14,
                      fontWeight: 600,
                      fontFamily: 'var(--font-inter, "DM Sans"), sans-serif',
                    }}
                  >
                    <ArrowDownBadge />
                    <span>{t('discountBadge', { percent: descontoPct })}</span>
                  </div>
                )}
                <p style={{ marginTop: 14, marginBottom: 0, fontSize: 14, color: '#4b5563', fontFamily: 'var(--font-inter, "DM Sans"), sans-serif' }}>
                  {t('youSaveMonthly', { amount: formatMoneyPrecise(Math.abs(poupancaMensal)) })}
                </p>
              </>
            )}
          </section>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4, fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '8px 4px', color: '#9ca3af', fontWeight: 600 }}>
                  {t('table.cost')}
                </th>
                <th style={{ textAlign: 'right', padding: '8px 4px', color: '#9ca3af', fontWeight: 600 }}>
                  {t('table.today')}
                </th>
                <th style={{ textAlign: 'right', padding: '8px 4px', color: '#9ca3af', fontWeight: 600 }}>
                  {t('table.withGodManager')}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '8px 4px' }}>{t('table.software')}</td>
                <td style={{ textAlign: 'right', fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>
                  {formatMoney(softwareMensal)}/{t('perMonthShort')}
                </td>
                <td style={{ textAlign: 'right', color: 'rgba(45,114,82,0.95)' }}>{t('table.included')}</td>
              </tr>
              <tr>
                <td style={{ padding: '8px 4px' }}>{t('table.bookkeeper')}</td>
                <td style={{ textAlign: 'right', fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>
                  {bookkeeper ? `${formatMoney(bookkeeperMensal)}/${t('perMonthShort')}` : formatMoney(0)}
                </td>
                <td style={{ textAlign: 'right', color: 'rgba(45,114,82,0.95)' }}>{t('table.included')}</td>
              </tr>
              <tr>
                <td style={{ padding: '8px 4px' }}>{t('table.auditor')}</td>
                <td style={{ textAlign: 'right', fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>
                  {auditor ? `${formatMoney(auditorMensal)}/${t('perMonthShort')}` : formatMoney(0)}
                </td>
                <td style={{ textAlign: 'right', color: 'rgba(45,114,82,0.95)' }}>{t('table.included')}</td>
              </tr>
              <tr>
                <td style={{ padding: '8px 4px' }}>{t('table.auditMonthly')}</td>
                <td style={{ textAlign: 'right', fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>
                  {monthlyAudit
                    ? `${formatMoney(monthlyAuditCostMonthly)}/${t('perMonthShort')}`
                    : formatMoney(0)}
                </td>
                <td style={{ textAlign: 'right', color: 'rgba(45,114,82,0.95)' }}>{t('table.included')}</td>
              </tr>
              <tr>
                <td style={{ padding: '8px 4px' }}>{t('table.insurance')}</td>
                <td style={{ textAlign: 'right', fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>
                  {eo ? `${formatMoney(seguroMensal)}/${t('perMonthShort')}` : formatMoney(0)}
                </td>
                <td style={{ textAlign: 'right', color: 'rgba(45,114,82,0.95)', fontSize: 11 }}>{t('table.includedEo')}</td>
              </tr>

              <tr style={{ borderTop: '2px solid #e5e7eb', fontWeight: 700, background: 'rgba(15,23,42,0.02)' }}>
                <td style={{ padding: '10px 4px' }}>{t('totalMonthly')}</td>
                <td style={{ textAlign: 'right', fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>
                  {formatMoneyPrecise(custoAtualMensal)}/{t('perMonthShort')}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>
                  {formatMoneyPrecise(godmanagerMensal)}/{t('perMonthShort')}
                </td>
              </tr>
              <tr style={{ fontWeight: 700, background: 'rgba(15,23,42,0.02)' }}>
                <td style={{ padding: '10px 4px' }}>{t('totalAnnual')}</td>
                <td style={{ textAlign: 'right', fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>{formatAnnualUsd(custoAtualAnual)}</td>
                <td style={{ textAlign: 'right', fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>{formatAnnualUsd(godmanagerAnual)}</td>
              </tr>
              <tr style={{ borderTop: '1px dashed #e5e7eb', background: 'rgba(45,114,82,0.06)' }}>
                <td style={{ padding: '10px 4px', fontWeight: 700 }}>{t('annualSavings')}</td>
                <td style={{ textAlign: 'right', fontFamily: 'ui-monospace, "JetBrains Mono", monospace', color: '#9ca3af', fontWeight: 600 }}>
                  —
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
                    fontWeight: 700,
                    color: showPositive ? 'var(--green, #2d7252)' : '#b91c1c',
                  }}
                >
                  {showPositive ? formatAnnualUsd(poupancaAnual) : formatAnnualUsd(-poupancaAnual)}
                </td>
              </tr>
              <tr style={{ background: 'rgba(45,114,82,0.06)' }}>
                <td style={{ padding: '10px 4px', fontWeight: 700 }}>{t('monthlySavings')}</td>
                <td style={{ textAlign: 'right', fontFamily: 'ui-monospace, "JetBrains Mono", monospace', color: '#9ca3af', fontWeight: 600 }}>
                  —
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
                    fontWeight: 700,
                    color: showPositive ? 'var(--green, #2d7252)' : '#b91c1c',
                  }}
                >
                  {showPositive ? `${formatMoneyPrecise(poupancaMensal)}/${t('perMonthShort')}` : `${formatMoneyPrecise(-poupancaMensal)}/${t('perMonthShort')}`}
                </td>
              </tr>
            </tbody>
          </table>

          <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 16, lineHeight: 1.55 }}>{t('footerDisclaimer')}</p>

          <Link
            href="/contacto?source=calculator"
            style={{
              display: 'inline-block',
              marginTop: 16,
              padding: '12px 22px',
              background: '#2d7252',
              color: '#fff',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 13,
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(45,114,82,0.25)',
              fontFamily: 'var(--font-inter, "DM Sans"), sans-serif',
            }}
          >
            {ctaKey === 'ctaHigh'
              ? t('ctaHigh')
              : ctaKey === 'ctaConsultor'
                ? t('ctaConsultor')
                : t('ctaNormal')}
          </Link>
        </div>
      </div>

      <style jsx global>{`
        @media (max-width: 900px) {
          .gm-savings-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {emailOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            maxWidth: 360,
            zIndex: 300,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 16,
            boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
          }}
          role="dialog"
          aria-label={t('emailPrompt')}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={closeEmail}
            style={{
              position: 'absolute',
              top: 8,
              right: 10,
              border: 'none',
              background: 'transparent',
              fontSize: 18,
              cursor: 'pointer',
              color: '#9ca3af',
            }}
          >
            ×
          </button>
          <p style={{ margin: '0 28px 12px 0', fontSize: 14, fontWeight: 600 }}>{t('emailPrompt')}</p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@company.com"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              marginBottom: 10,
              fontSize: 14,
            }}
          />
          <button
            type="button"
            onClick={sendEmail}
            style={{
              width: '100%',
              padding: '10px',
              background: '#2d7252',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('emailSend')}
          </button>
        </div>
      )}
    </>
  );
}

function ToggleRow({
  label,
  on,
  setOn,
  onLabel,
  offLabel,
}: {
  label: string;
  on: boolean;
  setOn: (v: boolean) => void;
  onLabel: string;
  offLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        setOn(!on);
      }}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        padding: '12px 14px',
        borderRadius: 8,
        border: '1px solid #e5e7eb',
        background: on ? 'rgba(45,114,82,0.06)' : '#fff',
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 600,
        color: '#374151',
        fontFamily: 'inherit',
      }}
    >
      {label}
      <span style={{ color: '#2d7252', fontSize: 12 }}>{on ? onLabel : offLabel}</span>
    </button>
  );
}

function MoneyInput({
  label,
  value,
  setValue,
}: {
  label: string;
  value: number;
  setValue: (n: number) => void;
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>
        {label}
      </span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => {
          setValue(Number(e.target.value || 0));
        }}
        style={{
          width: '100%',
          maxWidth: 220,
          padding: '10px 12px',
          borderRadius: 8,
          border: '1px solid #e5e7eb',
          fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
        }}
      />
    </label>
  );
}

function ArrowDownBadge() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0 }} fill="none">
      <path d="M12 15.5 5.25 8.75h13.5L12 15.5Z" fill="currentColor" />
    </svg>
  );
}
