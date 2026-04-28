import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { FaqSection } from '@/components/marketing/FaqSection';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { SiteHeader } from '@/components/landing/SiteHeader';

type PageProps = { params: { locale: string } };

export async function generateMetadata({ params: { locale } }: PageProps) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'faq' });
  return { title: `GodManager — ${t('title')}`, description: t('subtitle') };
}

export default async function FaqPage({ params: { locale } }: PageProps) {
  setRequestLocale(locale);
  const t = await getTranslations('faq');

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f8f4ec',
        color: '#1f2937',
        fontFamily: 'var(--font-inter, "DM Sans"), sans-serif',
        WebkitFontSmoothing: 'antialiased' as const,
      }}
    >
      <SiteHeader active="faq" />
      <main style={{ maxWidth: 920, margin: '0 auto', padding: '120px 32px 56px' }}>
        <header style={{ marginBottom: 40 }}>
          <h1
            style={{
              fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
              fontSize: 44,
              fontWeight: 600,
              letterSpacing: '-0.5px',
              margin: '0 0 12px',
            }}
          >
            {t('title')}
          </h1>
          <p style={{ fontSize: 16, color: '#6b7280', lineHeight: 1.6, margin: 0, maxWidth: 640 }}>
            {t('subtitle')}
          </p>
        </header>
        <FaqSection />

        <section
          style={{
            marginTop: 48,
            padding: 32,
            borderRadius: 12,
            background: '#1f2937',
            color: '#fff',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 20,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
                fontSize: 24,
                fontWeight: 600,
                color: '#c9a96e',
                margin: '0 0 8px',
              }}
            >
              {t('ctaTitle')}
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: '#e5e7eb', lineHeight: 1.65 }}>{t('ctaText')}</p>
          </div>
          <Link
            href="/contacto"
            style={{
              background: '#c9a96e',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 13,
              letterSpacing: '0.5px',
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(201,169,110,0.3)',
              whiteSpace: 'nowrap',
            }}
          >
            {t('ctaButton')}
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
