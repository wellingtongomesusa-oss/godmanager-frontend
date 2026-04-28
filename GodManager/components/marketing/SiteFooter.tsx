'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

export function SiteFooter() {
  const t = useTranslations('footer');

  return (
    <footer
      style={{
        marginTop: 64,
        padding: '32px 32px 48px',
        borderTop: '1px solid rgba(201,169,110,0.25)',
        background: '#1f2937',
        color: '#e5e7eb',
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 24,
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
              fontSize: 20,
              fontWeight: 600,
              color: '#fff',
              marginBottom: 8,
            }}
          >
            GodManager
          </div>
          <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', maxWidth: 280, lineHeight: 1.5 }}>
            {t('tagline')}
          </p>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#9ca3af',
              marginBottom: 4,
            }}
          >
            {t('links')}
          </span>
          <Link
            href="/faq"
            style={{ color: '#e5e7eb', textDecoration: 'none', fontSize: 14 }}
          >
            {t('faq')}
          </Link>
          <Link
            href="/services#calculator"
            style={{ color: '#e5e7eb', textDecoration: 'none', fontSize: 14 }}
          >
            {t('calculator')}
          </Link>
          <Link
            href="/contacto"
            style={{ color: '#e5e7eb', textDecoration: 'none', fontSize: 14 }}
          >
            {t('contact')}
          </Link>
        </nav>
      </div>
      <div
        style={{
          maxWidth: 1100,
          margin: '28px auto 0',
          paddingTop: 20,
          borderTop: '1px solid rgba(255,255,255,0.08)',
          fontSize: 11,
          color: '#6b7280',
          textAlign: 'center',
        }}
      >
        godmanager.com · Godroox LLC
      </div>
    </footer>
  );
}
