import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteHeader } from '@/components/landing/SiteHeader';

const STAT_KEYS = [
  { value: '98%', key: 'accuracy' as const },
  { value: '3×', key: 'faster' as const },
  { value: '24h', key: 'audit' as const },
];

const STEP_INDEX = [1, 2, 3, 4] as const;

type PageProps = { params: { locale: string } };

export async function generateMetadata({ params: { locale } }: PageProps) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'about' });
  return { title: `GodManager — ${t('title')}`, description: t('subtitle') };
}

function stepK(i: number): 'step1' | 'step2' | 'step3' | 'step4' {
  if (i === 1) return 'step1';
  if (i === 2) return 'step2';
  if (i === 3) return 'step3';
  return 'step4';
}

export default async function AboutPage({ params: { locale } }: PageProps) {
  setRequestLocale(locale);
  const t = await getTranslations('about');

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
      <SiteHeader active="about" />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '120px 32px 80px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
            fontSize: 48,
            fontWeight: 600,
            marginBottom: 8,
            letterSpacing: '-0.5px',
          }}
        >
          {t('title')}
        </h1>
        <p
          style={{
            fontSize: 18,
            color: '#6b7280',
            marginBottom: 48,
            maxWidth: 720,
            lineHeight: 1.6,
          }}
        >
          {t('subtitle')}
        </p>

        <section style={{ marginBottom: 48 }}>
          <h2
            style={{
              fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
              fontSize: 28,
              fontWeight: 600,
              color: '#c9a96e',
              marginBottom: 16,
              letterSpacing: '0.5px',
            }}
          >
            {t('missionTitle')}
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#1f2937', marginBottom: 16 }}>
            {t('mission1')}
          </p>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#1f2937', margin: 0 }}>{t('mission2')}</p>
        </section>

        <section style={{ marginBottom: 48 }}>
          <h2
            style={{
              fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
              fontSize: 28,
              fontWeight: 600,
              color: '#c9a96e',
              marginBottom: 16,
              letterSpacing: '0.5px',
            }}
          >
            {t('deliverTitle')}
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
              marginTop: 16,
            }}
          >
            {STAT_KEYS.map((s) => (
              <div
                key={s.key}
                style={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                  padding: 24,
                  boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
                }}
              >
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 600,
                    color: '#c9a96e',
                    fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
                    lineHeight: 1.1,
                  }}
                >
                  {s.value}
                </div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>{t(`stats.${s.key}`)}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: 48 }}>
          <h2
            style={{
              fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
              fontSize: 28,
              fontWeight: 600,
              color: '#c9a96e',
              marginBottom: 16,
              letterSpacing: '0.5px',
            }}
          >
            {t('howTitle')}
          </h2>
          <ol style={{ paddingLeft: 0, listStyle: 'none', margin: 0 }}>
            {STEP_INDEX.map((i) => {
              const sk = stepK(i);
              return (
                <li
                  key={sk}
                  style={{
                    display: 'flex',
                    gap: 16,
                    padding: '16px 0',
                    borderBottom: i === 4 ? 'none' : '1px solid rgba(31,41,55,0.08)',
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      background: 'rgba(201,169,110,0.15)',
                      color: '#c9a96e',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    {i}
                  </span>
                  <div>
                    <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, margin: 0 }}>
                      {t(sk)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section
          style={{
            background: '#1f2937',
            color: '#fff',
            padding: 32,
            borderRadius: 12,
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
              fontSize: 24,
              fontWeight: 600,
              color: '#c9a96e',
              marginBottom: 12,
            }}
          >
            {t('contactTitle')}
          </h2>
          <p style={{ fontSize: 14, color: '#e5e7eb', margin: 0, lineHeight: 1.7 }}>
            {t('contactInfo').split('w@godmanager.com').map((part, i, arr) => (
              <span key={i}>
                {part}
                {i < arr.length - 1 && (
                  <a
                    href="mailto:w@godmanager.com"
                    style={{ color: '#c9a96e', textDecoration: 'none', fontWeight: 600 }}
                  >
                    w@godmanager.com
                  </a>
                )}
              </span>
            ))}
          </p>
        </section>
      </div>
    </div>
  );
}
