'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

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

  const labelUpperStyle: CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--ink3)',
    display: 'block',
    marginBottom: 8,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    fontFamily: 'var(--font-body)',
  };

  return (
    <>
      <div className="gm-savings-root" style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 0.45fr) minmax(0, 0.55fr)',
            gap: 32,
            alignItems: 'flex-start',
          }}
          className="gm-savings-grid"
        >
          <div className="gm-savings-form" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <label style={labelUpperStyle}>
                {t('properties')} · {properties}
              </label>
              <input
                type="range"
                className="gm-calc-range"
                min={1}
                max={500}
                step={5}
                value={properties}
                onChange={(e) => {
                  setProperties(Number(e.target.value));
                }}
                style={
                  {
                    width: '100%',
                    '--gm-range-pct': `${((properties - 1) / (500 - 1)) * 100}%`,
                  } as CSSProperties
                }
              />
            </div>

            <div>
              <span style={labelUpperStyle}>{t('currentSoftware')}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {swatches.map(({ key, label }) => {
                  const selected = software === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setSoftware(key);
                        setOverrideSoftware('');
                      }}
                      className="gm-calc-software-btn"
                      style={{
                        position: 'relative',
                        padding: '12px 18px',
                        paddingRight: selected ? 36 : 18,
                        borderRadius: 8,
                        border: selected ? '1.5px solid #1e2b3d' : '1px solid var(--border)',
                        background: selected ? 'rgba(30, 43, 61, 0.06)' : 'var(--paper)',
                        boxShadow: selected ? undefined : 'none',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--ink2)',
                        fontFamily: 'var(--font-body)',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                      }}
                    >
                      {label}
                      {selected ? <SoftwareCheckIcon /> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={{ ...labelUpperStyle, marginBottom: 6 }}>{t('softwareCostOverride')}</label>
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
                  maxWidth: 240,
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'rgba(0,0,0,0.02)',
                  fontSize: 14,
                  color: 'var(--ink)',
                  fontFamily: 'var(--font-mono)',
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
                <p style={{ fontSize: 11, color: 'var(--ink3)', margin: '6px 0 0', lineHeight: 1.45 }}>
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
              background: 'var(--sand)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 24,
              position: 'sticky',
              top: 100,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
            className="gm-savings-result-card"
          >
            <style>{`
            .gm-save-hero-num {
              font-size: 72px;
              line-height: 1.05;
              font-weight: 500;
              letter-spacing: -0.02em;
              margin: 0;
              font-family: var(--font-heading);
            }
            .gm-save-hero-num--neg {
              color: #8b6f2a;
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
                padding: 'clamp(24px, 4vw, 40px) clamp(20px, 3vw, 32px)',
                borderRadius: 16,
                border: '1px solid var(--border)',
                background: !showPositive ? '#fbf6e8' : 'var(--paper)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                animation: 'gmFadeHero 0.35s ease',
              }}
            >
              <style>{`@keyframes gmFadeHero { from { opacity: 0.92 } to { opacity: 1 } }`}</style>
              {!showPositive ? (
                <>
                  <p
                    style={{
                      margin: '0 0 8px',
                      fontSize: 11,
                      letterSpacing: '0.1em',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      color: 'var(--ink2)',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    {t('annualGapNegative')}
                  </p>
                  <p className="gm-save-hero-num gm-save-hero-num--neg">{formatAnnualUsd(-poupancaAnual)}</p>
                  <p
                    style={{
                      marginTop: 16,
                      fontSize: 14,
                      color: 'var(--ink2)',
                      lineHeight: 1.65,
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    {t('worthItExplanation')}
                  </p>
                </>
              ) : (
                <>
                  <p
                    style={{
                      margin: '0 0 8px',
                      fontSize: 11,
                      letterSpacing: '0.1em',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      color: 'var(--ink2)',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    {t('youSaveAnually')}
                  </p>
                  <p className="gm-save-hero-num" style={{ color: '#1e2b3d' }}>
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
                        background: 'rgba(201, 169, 97, 0.12)',
                        color: '#8a6f3d',
                        padding: '6px 14px',
                        borderRadius: 999,
                        fontSize: 14,
                        fontWeight: 600,
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      <ArrowDownBadge />
                      <span>{t('discountBadge', { percent: descontoPct })}</span>
                    </div>
                  )}
                  <p
                    style={{
                      marginTop: 14,
                      marginBottom: 0,
                      fontSize: 14,
                      color: 'var(--ink2)',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    {t('youSaveMonthly', { amount: formatMoneyPrecise(Math.abs(poupancaMensal)) })}
                  </p>
                </>
              )}
            </section>

            <div className="gm-calc-table-wrap">
              <table className="gm-calc-table">
                <thead>
                  <tr>
                    <th>{t('table.cost')}</th>
                    <th>{t('table.today')}</th>
                    <th>{t('table.withGodManager')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="gm-calc-data-row">
                    <td>{t('table.software')}</td>
                    <td className="gm-calc-mono">
                      {formatMoney(softwareMensal)}/{t('perMonthShort')}
                    </td>
                    <td className="gm-calc-cell-right">
                      <span className="gm-calc-included">{t('table.included')}</span>
                    </td>
                  </tr>
                  <tr className="gm-calc-data-row">
                    <td>{t('table.bookkeeper')}</td>
                    <td className="gm-calc-mono">
                      {bookkeeper ? `${formatMoney(bookkeeperMensal)}/${t('perMonthShort')}` : formatMoney(0)}
                    </td>
                    <td className="gm-calc-cell-right">
                      <span className="gm-calc-included">{t('table.included')}</span>
                    </td>
                  </tr>
                  <tr className="gm-calc-data-row">
                    <td>{t('table.auditor')}</td>
                    <td className="gm-calc-mono">
                      {auditor ? `${formatMoney(auditorMensal)}/${t('perMonthShort')}` : formatMoney(0)}
                    </td>
                    <td className="gm-calc-cell-right">
                      <span className="gm-calc-included">{t('table.included')}</span>
                    </td>
                  </tr>
                  <tr className="gm-calc-data-row">
                    <td>{t('table.auditMonthly')}</td>
                    <td className="gm-calc-mono">
                      {monthlyAudit
                        ? `${formatMoney(monthlyAuditCostMonthly)}/${t('perMonthShort')}`
                        : formatMoney(0)}
                    </td>
                    <td className="gm-calc-cell-right">
                      <span className="gm-calc-included">{t('table.included')}</span>
                    </td>
                  </tr>
                  <tr className="gm-calc-data-row">
                    <td>{t('table.insurance')}</td>
                    <td className="gm-calc-mono">
                      {eo ? `${formatMoney(seguroMensal)}/${t('perMonthShort')}` : formatMoney(0)}
                    </td>
                    <td className="gm-calc-cell-right">
                      <span className="gm-calc-included gm-calc-included--sm">{t('table.includedEo')}</span>
                    </td>
                  </tr>

                  <tr className="gm-calc-total-row">
                    <td>{t('totalMonthly')}</td>
                    <td className="gm-calc-mono">
                      {formatMoneyPrecise(custoAtualMensal)}/{t('perMonthShort')}
                    </td>
                    <td className="gm-calc-mono">
                      {formatMoneyPrecise(godmanagerMensal)}/{t('perMonthShort')}
                    </td>
                  </tr>
                  <tr className="gm-calc-total-row">
                    <td>{t('totalAnnual')}</td>
                    <td className="gm-calc-mono">{formatAnnualUsd(custoAtualAnual)}</td>
                    <td className="gm-calc-mono">{formatAnnualUsd(godmanagerAnual)}</td>
                  </tr>
                  <tr className="gm-calc-savings-row">
                    <td>{t('annualSavings')}</td>
                    <td className="gm-calc-mono gm-calc-dash">—</td>
                    <td
                      className={`gm-calc-savings-val ${showPositive ? 'gm-calc-savings-val--pos' : 'gm-calc-savings-val--neg'}`}
                    >
                      {showPositive ? formatAnnualUsd(poupancaAnual) : formatAnnualUsd(-poupancaAnual)}
                    </td>
                  </tr>
                  <tr className="gm-calc-savings-row">
                    <td>{t('monthlySavings')}</td>
                    <td className="gm-calc-mono gm-calc-dash">—</td>
                    <td
                      className={`gm-calc-savings-val ${showPositive ? 'gm-calc-savings-val--pos' : 'gm-calc-savings-val--neg'}`}
                    >
                      {showPositive
                        ? `${formatMoneyPrecise(poupancaMensal)}/${t('perMonthShort')}`
                        : `${formatMoneyPrecise(-poupancaMensal)}/${t('perMonthShort')}`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="gm-calc-footer-note">{t('footerDisclaimer')}</p>

            <Link href="/contacto?source=calculator" className="gm-calc-cta">
              <span>
                {ctaKey === 'ctaHigh'
                  ? t('ctaHigh')
                  : ctaKey === 'ctaConsultor'
                    ? t('ctaConsultor')
                    : t('ctaNormal')}
              </span>
              <ArrowRightIcon />
            </Link>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .gm-calc-software-btn:hover {
          border-color: #1e2b3d !important;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
        }
        @media (max-width: 900px) {
          .gm-savings-grid {
            grid-template-columns: 1fr !important;
          }
          .gm-savings-result-card {
            position: relative !important;
            top: auto !important;
          }
        }
        .gm-calc-range {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          border-radius: 3px;
          accent-color: #1e2b3d;
          background: linear-gradient(
            to right,
            #1e2b3d 0%,
            #1e2b3d var(--gm-range-pct, 10%),
            rgba(0, 0, 0, 0.08) var(--gm-range-pct, 10%),
            rgba(0, 0, 0, 0.08) 100%
          );
        }
        .gm-calc-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #fff;
          border: 2px solid #1e2b3d;
          box-shadow: 0 2px 8px rgba(30, 43, 61, 0.2);
          cursor: pointer;
          margin-top: -7px;
        }
        .gm-calc-range::-moz-range-track {
          height: 6px;
          border-radius: 3px;
          background: rgba(0, 0, 0, 0.08);
        }
        .gm-calc-range::-moz-range-progress {
          height: 6px;
          border-radius: 3px;
          background: #1e2b3d;
        }
        .gm-calc-range::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #fff;
          border: 2px solid #1e2b3d;
          box-shadow: 0 2px 8px rgba(30, 43, 61, 0.2);
          cursor: pointer;
        }
        .gm-calc-table-wrap {
          margin-top: 24px;
          background: var(--paper);
          border-radius: 12px;
          border: 1px solid var(--border);
          overflow: hidden;
        }
        .gm-calc-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          font-family: var(--font-body);
          color: var(--ink2);
        }
        .gm-calc-table thead tr {
          background: rgba(30, 43, 61, 0.04);
          border-bottom: 1px solid var(--border);
        }
        .gm-calc-table th {
          text-align: left;
          padding: 14px 20px;
          color: var(--ink2);
          font-weight: 600;
          font-size: 11px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .gm-calc-table th:nth-child(2),
        .gm-calc-table th:nth-child(3) {
          text-align: right;
        }
        .gm-calc-table td {
          padding: 14px 20px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.04);
        }
        .gm-calc-data-row:hover {
          background: rgba(30, 43, 61, 0.02);
        }
        .gm-calc-mono {
          text-align: right;
          font-family: var(--font-mono);
          font-size: 13px;
        }
        .gm-calc-data-row td:nth-child(2).gm-calc-mono {
          color: #dc2626;
          font-weight: 600;
        }
        .gm-calc-total-row td:nth-child(2).gm-calc-mono {
          color: #dc2626;
          font-weight: 700;
        }
        .gm-calc-cell-right {
          text-align: right;
        }
        .gm-calc-included {
          display: inline-block;
          background: rgba(5, 150, 105, 0.1);
          color: #059669;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
        }
        .gm-calc-included--sm {
          font-size: 11px;
        }
        .gm-calc-total-row {
          font-weight: 600;
          background: rgba(30, 43, 61, 0.06);
          border-top: 1px solid var(--border);
        }
        .gm-calc-total-row td {
          border-bottom: 1px solid var(--border);
        }
        .gm-calc-savings-row {
          background: rgba(30, 43, 61, 0.1);
          font-weight: 700;
        }
        .gm-calc-savings-row td {
          border-bottom: none;
          color: #1e2b3d;
        }
        .gm-calc-savings-row td.gm-calc-dash {
          color: var(--ink3);
        }
        .gm-calc-savings-row td.gm-calc-savings-val--neg {
          color: var(--amber);
        }
        .gm-calc-savings-val {
          text-align: right;
          font-family: var(--font-heading);
          font-size: 18px;
          font-weight: 600;
        }
        .gm-calc-savings-val--neg {
          color: var(--amber);
        }
        .gm-calc-dash {
          color: var(--ink3);
          font-weight: 600;
        }
        .gm-calc-footer-note {
          font-size: 12px;
          color: var(--ink3);
          line-height: 1.6;
          margin-top: 20px;
          margin-bottom: 0;
          max-width: 600px;
        }
        .gm-calc-cta {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-top: 20px;
          padding: 14px 28px;
          background: #c9a961;
          color: #fff !important;
          border-radius: 8px;
          font-weight: 600;
          font-size: 15px;
          text-decoration: none !important;
          font-family: var(--font-body);
          box-shadow: 0 2px 8px rgba(201, 169, 97, 0.3);
          transition: background 0.2s ease, box-shadow 0.2s ease;
        }
        .gm-calc-cta:hover {
          background: #b08f4a !important;
          box-shadow: 0 4px 12px rgba(201, 169, 97, 0.35);
        }
        .gm-calc-cta svg {
          flex-shrink: 0;
        }
        .gm-calc-toggle-ui {
          position: relative;
          width: 44px;
          height: 24px;
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.15);
          transition: background 0.2s ease;
          flex-shrink: 0;
        }
        .gm-calc-toggle-ui[data-on='1'] {
          background: #1e2b3d;
        }
        .gm-calc-toggle-knob {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          transition: transform 0.2s ease;
        }
        .gm-calc-toggle-ui[data-on='1'] .gm-calc-toggle-knob {
          transform: translateX(20px);
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
            background: 'var(--paper)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 16,
            boxShadow: '0 12px 40px rgba(26, 26, 28, 0.12)',
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
              color: 'var(--ink3)',
            }}
          >
            ×
          </button>
          <p
            style={{
              margin: '0 28px 12px 0',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--ink)',
              fontFamily: 'var(--font-body)',
            }}
          >
            {t('emailPrompt')}
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@company.com"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid var(--border2)',
              background: 'var(--sand)',
              marginBottom: 10,
              fontSize: 14,
              color: 'var(--ink)',
              fontFamily: 'var(--font-body)',
            }}
          />
          <button
            type="button"
            onClick={sendEmail}
            style={{
              width: '100%',
              padding: '10px',
              background: 'var(--amber)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
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
      className="gm-calc-toggle-row"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        padding: '16px 0',
        margin: 0,
        border: 'none',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        borderRadius: 0,
        background: 'transparent',
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 600,
        color: 'var(--ink2)',
        fontFamily: 'var(--font-body)',
        textAlign: 'left',
      }}
    >
      <span style={{ paddingRight: 16 }}>{label}</span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
          fontSize: 12,
          fontWeight: 600,
          color: on ? '#1e2b3d' : 'var(--ink3)',
        }}
      >
        <span className="gm-calc-toggle-ui" data-on={on ? '1' : '0'}>
          <span className="gm-calc-toggle-knob" />
        </span>
        {on ? onLabel : offLabel}
      </span>
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
    <label style={{ display: 'block', marginTop: 8 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--ink3)',
          display: 'block',
          marginBottom: 6,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          fontFamily: 'var(--font-body)',
        }}
      >
        {label}
      </span>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          maxWidth: 240,
          borderRadius: 6,
          border: '1px solid var(--border)',
          background: 'rgba(0,0,0,0.02)',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            padding: '10px 0 10px 12px',
            fontSize: 14,
            color: 'var(--ink3)',
            fontFamily: 'var(--font-mono)',
            userSelect: 'none',
          }}
        >
          $
        </span>
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => {
            setValue(Number(e.target.value || 0));
          }}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '10px 12px 10px 4px',
            border: 'none',
            background: 'transparent',
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            color: 'var(--ink)',
          }}
        />
      </div>
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

function ArrowRightIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SoftwareCheckIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      aria-hidden
      style={{ position: 'absolute', top: 10, right: 12 }}
      fill="none"
    >
      <path
        d="M20 6L9 17l-5-5"
        stroke="#1e2b3d"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
