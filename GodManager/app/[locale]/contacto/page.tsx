import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SiteHeader } from '@/components/landing/SiteHeader';
import ContactForm from './ContactForm';

type PageProps = { params: { locale: string } };

export async function generateMetadata({ params: { locale } }: PageProps) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'contact' });
  return { title: `GodManager — ${t('title')}` };
}

export default async function ContactoPage({ params: { locale } }: PageProps) {
  setRequestLocale(locale);
  const t = await getTranslations('contact');
  const tNav = await getTranslations('nav');

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--paper)',
        color: 'var(--ink)',
        fontFamily: 'var(--font-inter, "DM Sans"), sans-serif',
        WebkitFontSmoothing: 'antialiased' as const,
      }}
    >
      <SiteHeader active="contact" />
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '120px 32px 80px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 40,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
              fontSize: 40,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            {t('title')}
          </h1>
          <p style={{ fontSize: 16, color: 'var(--ink2)', marginBottom: 32, lineHeight: 1.6 }}>{t('subtitle')}</p>
          <div
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: 24,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--amber)',
                letterSpacing: 1,
                textTransform: 'uppercase' as const,
                marginBottom: 6,
              }}
            >
              {t('emailLabel')}
            </div>
            <a
              href="mailto:w@godmanager.us"
              style={{ fontSize: 18, color: 'var(--ink)', textDecoration: 'none', fontWeight: 600 }}
            >
              w@godmanager.us
            </a>
          </div>
          <div
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: 24,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--amber)',
                letterSpacing: 1,
                textTransform: 'uppercase' as const,
                marginBottom: 6,
              }}
            >
              {t('smsLabel')}
            </div>
            <a
              href="https://wa.me/13215194710"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 18, color: 'var(--ink)', textDecoration: 'none', fontWeight: 600 }}
            >
              (321) 519-4710
            </a>
            <p style={{ fontSize: 12, color: 'var(--ink2)', margin: '6px 0 0' }}>{t('smsNote')}</p>
          </div>
          <div
            style={{ background: 'var(--sidebar-bg)', color: '#fff', padding: 24, borderRadius: 10 }}
          >
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.9)', margin: 0, lineHeight: 1.6 }}>
              {t('responseTime')}{' '}
              <Link href="/request-demo" style={{ color: 'var(--amber)', textDecoration: 'underline' }}>
                {tNav('requestDemo')}
              </Link>
              .
            </p>
          </div>
        </div>
        <div>
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
