'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const SESSION_KEY = 'gm_calc_email_dismissed';

type SoftwareKey = 'appfolio' | 'buildium' | 'excel' | 'other' | 'none';

const DEFAULT_SOFTWARE: Record<SoftwareKey, number> = {
  appfolio: 475,
  buildium: 232,
  excel: 0,
  other: 200,
  none: 0,
};

function formatMoney(n: number): string {
  const abs = Math.abs(Math.round(n));
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(abs);
}

export function SavingsCalculator() {
  const t = useTranslations('savingsCalculator');
  const [properties, setProperties] = useState(50);
  const [software, setSoftware] = useState<SoftwareKey>('appfolio');
  const [overrideSoftware, setOverrideSoftware] = useState('');
  const [bookkeeper, setBookkeeper] = useState(false);
  const [salaryAnnual, setSalaryAnnual] = useState(54_000);
  const [auditor, setAuditor] = useState(false);
  const [auditorAnnual, setAuditorAnnual] = useState(5000);
  const [eo, setEo] = useState(false);
  const [eoAnnual, setEoAnnual] = useState(3500);
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [headlineFade, setHeadlineFade] = useState(0);
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const defaultSoft = DEFAULT_SOFTWARE[software];
  const softwareMensal = useMemo(() => {
    const trimmed = overrideSoftware.trim();
    if (trimmed === '') return defaultSoft;
    const n = Number.parseFloat(trimmed.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? Math.max(0, n) : defaultSoft;
  }, [overrideSoftware, defaultSoft, software]);

  const bookkeeperMensal = bookkeeper ? (salaryAnnual / 12) * 1.3 : 0;
  const auditorMensal = auditor ? auditorAnnual / 12 : 0;
  const seguroMensal = eo ? eoAnnual / 12 : 0;
  const custoAtualMensal = softwareMensal + bookkeeperMensal + auditorMensal + seguroMensal;
  const godmanagerMensal = properties * 15;
  const poupancaMensal = custoAtualMensal - godmanagerMensal;
  const poupancaAnual = poupancaMensal * 12;

  const prevHeadline = useRef(poupancaMensal);
  useEffect(() => {
    if (prevHeadline.current !== poupancaMensal) {
      prevHeadline.current = poupancaMensal;
      setHeadlineFade((k) => k + 1);
    }
  }, [poupancaMensal]);

  const displayAmount = period === 'month' ? poupancaMensal : poupancaAnual;
  const positive = displayAmount >= 0;

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
              onChange={(e) => setProperties(Number(e.target.value))}
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
              onChange={(e) => setOverrideSoftware(e.target.value)}
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
            label={t('eoToggle')}
            on={eo}
            setOn={setEo}
            onLabel={t('toggleOn')}
            offLabel={t('toggleOff')}
          />
          {eo && <MoneyInput label={t('eoAnnual')} value={eoAnnual} setValue={setEoAnnual} />}
        </div>

        <div
          key={headlineFade}
          style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 24,
            position: 'sticky',
            top: 100,
            boxShadow: '0 4px 20px rgba(15,23,42,0.06)',
            animation: 'gmFadeIn 0.35s ease',
          }}
        >
          <style>{`@keyframes gmFadeIn { from { opacity: 0.65 } to { opacity: 1 } }`}</style>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setPeriod('month')}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: period === 'month' ? '1px solid #2d7252' : '1px solid #e5e7eb',
                background: period === 'month' ? 'rgba(45,114,82,0.1)' : 'transparent',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {t('monthlyToggle')}
            </button>
            <button
              type="button"
              onClick={() => setPeriod('year')}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: period === 'year' ? '1px solid #2d7252' : '1px solid #e5e7eb',
                background: period === 'year' ? 'rgba(45,114,82,0.1)' : 'transparent',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {t('annualToggle')}
            </button>
          </div>

          {positive ? (
            <>
              <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#6b7280' }}>
                {t('youSave')}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 36,
                  fontWeight: 700,
                  fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
                  color: 'var(--green, #2d7252)',
                }}
              >
                {formatMoney(period === 'month' ? poupancaMensal : poupancaAnual)}
                <span style={{ fontSize: 16, fontWeight: 600 }}>
                  {' '}
                  / {period === 'month' ? t('perMonth') : t('perYear')}
                </span>
              </p>
            </>
          ) : (
            <>
              <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#b91c1c' }}>
                {t('godmanagerCostsMore')}
              </p>
              <p
                style={{
                  margin: '0 0 12px',
                  fontSize: 28,
                  fontWeight: 700,
                  fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
                  color: '#b91c1c',
                }}
              >
                {formatMoney(period === 'month' ? -poupancaMensal : -poupancaAnual)}
                <span style={{ fontSize: 14 }}>
                  {' '}
                  / {period === 'month' ? t('perMonth') : t('perYear')}
                </span>
              </p>
              <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, margin: 0 }}>{t('negativeExplainer')}</p>
            </>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 20, fontSize: 12 }}>
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
                <td style={{ textAlign: 'right', color: '#2d7252' }}>{t('table.included')}</td>
              </tr>
              <tr>
                <td style={{ padding: '8px 4px' }}>{t('table.bookkeeper')}</td>
                <td style={{ textAlign: 'right', fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>
                  {bookkeeper ? `${formatMoney(bookkeeperMensal)}/${t('perMonthShort')}` : formatMoney(0)}
                </td>
                <td style={{ textAlign: 'right', color: '#2d7252' }}>{t('table.included')}</td>
              </tr>
              <tr>
                <td style={{ padding: '8px 4px' }}>{t('table.auditor')}</td>
                <td style={{ textAlign: 'right', fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>
                  {auditor ? `${formatMoney(auditorMensal)}/${t('perMonthShort')}` : formatMoney(0)}
                </td>
                <td style={{ textAlign: 'right', color: '#2d7252' }}>{t('table.included')}</td>
              </tr>
              <tr>
                <td style={{ padding: '8px 4px' }}>{t('table.insurance')}</td>
                <td style={{ textAlign: 'right', fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>
                  {eo ? `${formatMoney(seguroMensal)}/${t('perMonthShort')}` : formatMoney(0)}
                </td>
                <td style={{ textAlign: 'right', color: '#2d7252', fontSize: 11 }}>{t('table.includedEo')}</td>
              </tr>
              <tr style={{ borderTop: '2px solid #e5e7eb', fontWeight: 700 }}>
                <td style={{ padding: '10px 4px' }}>{t('table.total')}</td>
                <td style={{ textAlign: 'right', fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>
                  {formatMoney(custoAtualMensal)}/{t('perMonthShort')}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}>
                  {formatMoney(godmanagerMensal)}/{t('perMonthShort')}
                </td>
              </tr>
              <tr style={{ background: 'rgba(45,114,82,0.06)' }}>
                <td style={{ padding: '10px 4px', color: '#2d7252' }}>{t('table.savings')}</td>
                <td />
                <td
                  style={{
                    textAlign: 'right',
                    fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
                    color: positive ? '#2d7252' : '#b91c1c',
                  }}
                >
                  {formatMoney(poupancaMensal)}/{t('perMonthShort')}
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
            }}
          >
            {t('ctaButton')}
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
      onClick={() => setOn(!on)}
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
        onChange={(e) => setValue(Number(e.target.value || 0))}
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
