import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteHeader } from '@/components/landing/SiteHeader';
import { RequestDemoForm } from './RequestDemoForm';

const BULLET_KEYS = ['b1', 'b2', 'b3', 'b4'] as const;

type PageProps = { params: { locale: string } };

export async function generateMetadata({ params: { locale } }: PageProps) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'demo' });
  return { title: `GodManager — ${t('title')}`, description: t('subtitle') };
}

export default async function RequestDemoPage({ params: { locale } }: PageProps) {
  setRequestLocale(locale);
  const t = await getTranslations('demo');

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f172a',
        color: '#fff',
        fontFamily: 'var(--font-inter, "DM Sans"), sans-serif',
        WebkitFontSmoothing: 'antialiased' as const,
      }}
    >
      <SiteHeader active="request" />
      <main
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          padding: '120px 32px 64px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 48,
          alignItems: 'start',
        }}
      >
        <section>
          <p
            style={{
              color: '#c9a96e',
              fontSize: 11,
              letterSpacing: '3px',
              textTransform: 'uppercase',
              marginBottom: 16,
            }}
          >
            {t('kicker')}
          </p>
          <h1
            style={{
              fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
              fontSize: 44,
              fontWeight: 600,
              lineHeight: 1.1,
              marginBottom: 20,
            }}
          >
            {t('lead')}
          </h1>
          <p style={{ color: '#cbd5e1', fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>{t('leadP')}</p>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {BULLET_KEYS.map((k) => (
              <li
                key={k}
                style={{
                  color: '#e5e7eb',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#c9a96e',
                  }}
                />
                {t(`bullets.${k}`)}
              </li>
            ))}
          </ul>
        </section>
        <section
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(201,169,110,0.2)',
            borderRadius: 12,
            padding: 32,
          }}
        >
          <RequestDemoForm />
        </section>
      </main>
    </div>
  );
}
