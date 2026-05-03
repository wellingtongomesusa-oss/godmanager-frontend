'use client';

import { Link } from '@/i18n/navigation';

export default function CancelClient() {
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
      <h1
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 28,
          fontWeight: 600,
          color: 'var(--ink)',
          marginBottom: 12,
        }}
      >
        Checkout canceled
      </h1>
      <p style={{ fontSize: 15, color: 'var(--ink2)', marginBottom: 28, lineHeight: 1.55 }}>
        No charge was made. You can return to pricing or continue your free trial.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link
          href="/pricing"
          style={{
            padding: '12px 24px',
            background: 'var(--amber)',
            color: '#fff',
            borderRadius: 8,
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 14,
            boxShadow: '0 2px 8px rgba(201,169,110,.25)',
          }}
        >
          Back to pricing
        </Link>
        <Link
          href="/GodManager_Premium.html"
          style={{
            padding: '12px 24px',
            background: 'transparent',
            color: 'var(--blue)',
            borderRadius: 8,
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 14,
            border: '1px solid var(--blue)',
          }}
        >
          Continue trial
        </Link>
      </div>
    </main>
  );
}
