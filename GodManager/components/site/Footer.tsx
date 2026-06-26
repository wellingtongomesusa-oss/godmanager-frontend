'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

export default function Footer() {
  const year = new Date().getFullYear();
  const t = useTranslations('footer');

  return (
    <footer
      className="font-body antialiased"
      style={{
        borderTop: '1px solid var(--border)',
        background: 'var(--sand)',
        padding: '32px 20px',
        marginTop: 60,
        fontSize: 13,
        color: 'var(--ink3)',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 20,
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
            © {year} Godroox LLC. All rights reserved.
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink2)' }}>
            GodManager™ is a trademark of Godroox LLC, registered in Florida, USA.
          </div>
        </div>
        <nav style={{ display: 'flex', gap: 20, fontSize: 13 }} aria-label="Legal">
          <Link href="/terms" style={{ color: 'var(--ink2)', textDecoration: 'none' }}>
            {t('terms')}
          </Link>
          <Link href="/privacy" style={{ color: 'var(--ink2)', textDecoration: 'none' }}>
            {t('privacy')}
          </Link>
          <Link href="/security" style={{ color: 'var(--ink2)', textDecoration: 'none' }}>
            {t('security')}
          </Link>
          <a href="mailto:contact@godmanager.us" style={{ color: 'var(--ink2)', textDecoration: 'none' }}>
            {t('contactEmail')}
          </a>
        </nav>
      </div>
    </footer>
  );
}
