import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteHeader } from '@/components/landing/SiteHeader';

const GROUPS: { categoryKey: 'bookkeeping' | 'consulting' | '1099'; itemKeys: string[] }[] = [
  {
    categoryKey: 'bookkeeping',
    itemKeys: [
      'allServices',
      'trustBookkeeping',
      'corporateBookkeeping',
      'dailyBankRecs',
      'dailyAudits',
    ],
  },
  {
    categoryKey: 'consulting',
    itemKeys: [
      'onDemandConsulting',
      'financialDiagnostic',
      'bankCatchUp',
      'threeWay',
      'trustAudit',
      'cashSuspect',
    ],
  },
  {
    categoryKey: '1099',
    itemKeys: ['1099ebook', '1099webinar', '1099filing'],
  },
];

type PageProps = { params: { locale: string } };

export async function generateMetadata({ params: { locale } }: PageProps) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'services' });
  return {
    title: `GodManager — ${t('title')}`,
    description: t('subtitle'),
  };
}

export default async function ServicesPage({ params: { locale } }: PageProps) {
  setRequestLocale(locale);
  const t = await getTranslations('services');

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
      <SiteHeader active="services" />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '120px 32px 80px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
            fontSize: 48,
            fontWeight: 600,
            color: '#1f2937',
            marginBottom: 8,
            letterSpacing: '-0.5px',
          }}
        >
          {t('title')}
        </h1>
        <p
          style={{
            color: '#6b7280',
            fontSize: 16,
            lineHeight: 1.6,
            marginBottom: 48,
            maxWidth: 720,
          }}
        >
          {t('subtitle')}
        </p>
        {GROUPS.map((group) => (
          <section key={group.categoryKey} style={{ marginBottom: 56 }}>
            <h2
              style={{
                fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
                fontSize: 28,
                fontWeight: 600,
                color: '#c9a96e',
                marginBottom: 20,
                letterSpacing: '0.5px',
              }}
            >
              {t(`categories.${group.categoryKey}`)}
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 16,
              }}
            >
              {group.itemKeys.map((key) => (
                <article
                  key={key}
                  style={{
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    padding: 24,
                    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
                  }}
                >
                  <h3
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: '#1f2937',
                      marginBottom: 8,
                    }}
                  >
                    {t((`items.${key}.name`) as 'items.allServices.name')}
                  </h3>
                  <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, margin: 0 }}>
                    {t((`items.${key}.desc`) as 'items.allServices.desc')}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ))}
        <section
          style={{
            marginTop: 32,
            padding: 32,
            borderRadius: 12,
            background: '#1f2937',
            color: '#fff',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 24,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3
              style={{
                fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
                fontSize: 24,
                fontWeight: 600,
                color: '#c9a96e',
                marginBottom: 6,
              }}
            >
              {t('ctaTitle')}
            </h3>
            <p style={{ fontSize: 14, color: '#e5e7eb', margin: 0 }}>{t('ctaSubtitle')}</p>
          </div>
          <a
            href="mailto:w@godmanager.com?subject=GodManager%20Demo%20Request"
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
            }}
          >
            {t('ctaButton')}
          </a>
        </section>
      </div>
    </div>
  );
}
