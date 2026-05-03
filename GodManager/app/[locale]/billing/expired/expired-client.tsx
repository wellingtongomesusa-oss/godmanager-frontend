'use client';

import { Link } from '@/i18n/navigation';

function ClockGlyph() {
  return (
    <div
      aria-hidden
      style={{
        width: 56,
        height: 56,
        margin: '0 auto 16px',
        borderRadius: '50%',
        border: '2px solid var(--amber)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: 22,
        fontWeight: 700,
        color: 'var(--amber)',
      }}
    >
      30
    </div>
  );
}

export default function ExpiredClient() {
  return (
    <main
      style={{
        maxWidth: 560,
        margin: '0 auto',
        padding: '72px 24px 48px',
        fontFamily: 'var(--font-body)',
        textAlign: 'center',
        color: 'var(--ink)',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      <ClockGlyph />
      <h1
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 28,
          fontWeight: 600,
          color: 'var(--amber)',
          marginBottom: 12,
        }}
      >
        Your trial has expired
      </h1>
      <p style={{ fontSize: 15, color: 'var(--ink2)', marginBottom: 28, lineHeight: 1.55 }}>
        Your data is safe. Choose a plan to continue using GodManager — your account, properties,
        tenants, and history are all preserved.
      </p>
      <Link
        href="/pricing"
        style={{
          display: 'inline-block',
          padding: '14px 32px',
          background: 'var(--amber)',
          color: '#fff',
          borderRadius: 8,
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: 14,
          boxShadow: '0 2px 8px rgba(201,169,110,.25)',
        }}
      >
        Choose a plan
      </Link>
      <p style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 24 }}>
        Need help?{' '}
        <a href="mailto:support@godmanager.us" style={{ color: 'var(--blue)', fontWeight: 600 }}>
          Contact support
        </a>
      </p>
    </main>
  );
}
