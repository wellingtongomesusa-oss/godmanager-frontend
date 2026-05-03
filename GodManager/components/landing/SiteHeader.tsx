'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from './LanguageSwitcher';

const linkBase = {
  textDecoration: 'none' as const,
  fontFamily: 'var(--font-inter, "DM Sans"), sans-serif',
  fontSize: 13,
  letterSpacing: '0.5px',
} as const;

function navStyle(isActive: boolean): React.CSSProperties {
  return {
    ...linkBase,
    color: isActive ? '#fff' : '#e5e7eb',
    fontWeight: isActive ? 600 : 400,
  };
}

export function SiteHeader({
  active: activeNav,
}: {
  active: 'home' | 'services' | 'savings' | 'faq' | 'about' | 'contact' | 'request';
}) {
  const t = useTranslations();

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: 'rgba(15,23,42,0.95)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: '14px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(201,169,110,0.2)',
      }}
    >
      <Link
        href="/login"
        style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            background: '#c9a96e',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
            fontSize: 18,
          }}
        >
          G
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span
            style={{
              color: '#fff',
              fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: '0.5px',
            }}
          >
            {t('site.name')}
          </span>
          <span
            style={{
              color: '#c9a96e',
              fontFamily: 'var(--font-inter, "DM Sans"), sans-serif',
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '2px',
              marginTop: 4,
              textTransform: 'uppercase',
            }}
          >
            {t('site.tagline')}
          </span>
        </div>
      </Link>
      <nav style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        <Link href="/login" style={navStyle(activeNav === 'home')}>
          {t('nav.home')}
        </Link>
        <Link href="/services" style={navStyle(activeNav === 'services')}>
          {t('nav.services')}
        </Link>
        <Link
          href="/savings"
          style={{
            background: activeNav === 'savings' ? '#c9a96e' : 'rgba(201,169,110,0.15)',
            color: activeNav === 'savings' ? '#fff' : '#c9a96e',
            padding: '6px 14px',
            border: '1px solid #c9a96e',
            borderRadius: 6,
            fontFamily: 'var(--font-inter, "DM Sans"), sans-serif',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.3px',
            textDecoration: 'none',
            transition: 'all 0.2s',
          }}
        >
          {t('nav.pricing')}
        </Link>
        <Link href="/faq" style={navStyle(activeNav === 'faq')}>
          {t('nav.faq')}
        </Link>
        <Link href="/about" style={navStyle(activeNav === 'about')}>
          {t('nav.about')}
        </Link>
        <Link href="/contacto" style={navStyle(activeNav === 'contact')}>
          {t('nav.contact')}
        </Link>
        <Link
          href="/request-demo"
          style={{
            background: '#c9a96e',
            color: '#fff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: 6,
            fontFamily: 'var(--font-inter, "DM Sans"), sans-serif',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.5px',
            textDecoration: 'none',
            boxShadow: '0 2px 8px rgba(201,169,110,0.3)',
          }}
        >
          {t('nav.requestDemo')}
        </Link>
        <LanguageSwitcher />
      </nav>
    </header>
  );
}
