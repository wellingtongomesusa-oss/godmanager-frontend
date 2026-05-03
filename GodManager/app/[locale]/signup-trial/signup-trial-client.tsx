'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { SiteHeader } from '@/components/landing/SiteHeader';

function SignupTrialForm() {
  const params = useSearchParams();
  const router = useRouter();
  const t = useTranslations('signupTrial');

  const segment = params.get('segment') || 'LONG_TERM';
  const tier = params.get('tier') || '1';
  const avgRent = params.get('avgRent') || '0';
  const avgVgv = params.get('avgVgv') || '0';
  const unitCount = params.get('unitCount') || '1';
  const interval = params.get('interval') || 'MONTHLY';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const resp = await fetch('/api/auth/register-with-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password,
          companyName,
          segment,
          packageTier: Number(tier),
          avgRent: Number(avgRent),
          avgVgv: Number(avgVgv),
          unitCount: Number(unitCount),
          interval,
        }),
      });

      const data = (await resp.json()) as { ok?: boolean; error?: string };
      if (!resp.ok || !data.ok) {
        setError(data.error || t('registerFailed'));
        setLoading(false);
        return;
      }

      router.push(`/login?email=${encodeURIComponent(email)}&trial_signup=true`);
    } catch {
      setError(t('registerFailed'));
      setLoading(false);
    }
  }

  const ink = 'var(--ink)';
  const ink2 = 'var(--ink2)';
  const ink3 = 'var(--ink3)';
  const border = 'var(--border)';
  const blue = 'var(--blue)';
  const amber = 'var(--amber)';
  const sand = 'var(--sand)';

  const inputStyle: React.CSSProperties = {
    padding: '10px 14px',
    border: `1px solid var(--border2)`,
    borderRadius: 8,
    fontSize: 14,
    fontFamily: 'var(--font-body)',
    background: 'var(--paper)',
    color: ink,
    width: '100%',
    boxSizing: 'border-box',
  };

  const showLtTier = segment === 'LONG_TERM' && tier !== '1';

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
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '96px 24px 48px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 28,
            fontWeight: 600,
            color: ink,
            marginBottom: 8,
          }}
        >
          {t('title')}
        </h1>
        <p style={{ fontSize: 14, color: ink2, marginBottom: 24, lineHeight: 1.55 }}>
          {t('subtitle', { segment })}
          {showLtTier ? t('subtitleLt', { tier }) : ''}.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label htmlFor="st-company" style={{ fontSize: 10, fontWeight: 600, color: ink3, letterSpacing: '0.04em' }}>
              {t('companyName')}
            </label>
            <input
              id="st-company"
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              style={{ ...inputStyle, marginTop: 6 }}
              autoComplete="organization"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label htmlFor="st-fn" style={{ fontSize: 10, fontWeight: 600, color: ink3, letterSpacing: '0.04em' }}>
                {t('firstName')}
              </label>
              <input
                id="st-fn"
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                style={{ ...inputStyle, marginTop: 6 }}
                autoComplete="given-name"
              />
            </div>
            <div>
              <label htmlFor="st-ln" style={{ fontSize: 10, fontWeight: 600, color: ink3, letterSpacing: '0.04em' }}>
                {t('lastName')}
              </label>
              <input
                id="st-ln"
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                style={{ ...inputStyle, marginTop: 6 }}
                autoComplete="family-name"
              />
            </div>
          </div>
          <div>
            <label htmlFor="st-email" style={{ fontSize: 10, fontWeight: 600, color: ink3, letterSpacing: '0.04em' }}>
              {t('email')}
            </label>
            <input
              id="st-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ ...inputStyle, marginTop: 6 }}
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="st-pw" style={{ fontSize: 10, fontWeight: 600, color: ink3, letterSpacing: '0.04em' }}>
              {t('password')}
            </label>
            <input
              id="st-pw"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...inputStyle, marginTop: 6 }}
              autoComplete="new-password"
            />
          </div>

          {error ? (
            <div
              style={{
                padding: 10,
                background: 'var(--red-bg)',
                color: 'var(--red)',
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px 24px',
              background: loading ? 'var(--ink3)' : amber,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              cursor: loading ? 'wait' : 'pointer',
              marginTop: 8,
              boxShadow: loading ? 'none' : '0 2px 8px rgba(201,169,110,.25)',
              fontFamily: 'var(--font-body)',
            }}
          >
            {loading ? t('submitting') : t('submit')}
          </button>
        </form>

        <p style={{ fontSize: 12, color: ink2, marginTop: 20, textAlign: 'center' }}>
          {t('alreadyHave')}{' '}
          <Link href="/login" style={{ color: blue, fontWeight: 600, textDecoration: 'none' }}>
            {t('signInLink')}
          </Link>
        </p>
      </main>
    </div>
  );
}

export default function SignupTrialClient() {
  const t = useTranslations('signupTrial');
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '40vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-body)',
            color: 'var(--ink2)',
          }}
        >
          {t('loading')}
        </div>
      }
    >
      <SignupTrialForm />
    </Suspense>
  );
}
