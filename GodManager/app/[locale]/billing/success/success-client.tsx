'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';

function CheckIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden style={{ marginBottom: 16 }}>
      <circle cx="28" cy="28" r="26" fill="none" stroke="var(--green)" strokeWidth="2" />
      <path
        d="M17 29l8 8 14-16"
        fill="none"
        stroke="var(--green)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SuccessContent() {
  const params = useSearchParams();
  const sessionId = params.get('session_id');

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
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <CheckIcon />
      </div>
      <h1
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 28,
          fontWeight: 600,
          color: 'var(--green)',
          marginBottom: 12,
        }}
      >
        Payment successful
      </h1>
      <p style={{ fontSize: 15, color: 'var(--ink2)', marginBottom: 24, lineHeight: 1.55 }}>
        Your subscription is now active. You can start using GodManager right away.
      </p>
      {sessionId ? (
        <div
          style={{
            fontSize: 11,
            color: 'var(--ink3)',
            marginBottom: 24,
            fontFamily: 'var(--font-mono)',
          }}
        >
          Reference: {sessionId.slice(0, 24)}...
        </div>
      ) : null}
      <Link
        href="/GodManager_Premium.html"
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
        Go to dashboard
      </Link>
    </main>
  );
}

export default function SuccessClient() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            padding: 48,
            textAlign: 'center',
            fontFamily: 'var(--font-body)',
            color: 'var(--ink2)',
          }}
        >
          Loading...
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
