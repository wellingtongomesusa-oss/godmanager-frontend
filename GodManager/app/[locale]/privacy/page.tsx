import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LegalArticle } from '@/components/legal/LegalArticle';
import { LegalPageLayout } from '@/components/legal/LegalPageLayout';
import { PrivacyContent } from '@/components/legal/privacy/PrivacyContent';
import type { AppLocale } from '@/i18n/routing';
import { routing } from '@/i18n/routing';

type PageProps = { params: { locale: string } };

export async function generateMetadata({ params: { locale } }: PageProps) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'legal.privacy' });
  return { title: `GodManager — ${t('title')}`, description: t('description') };
}

export default async function PrivacyPage({ params: { locale } }: PageProps) {
  setRequestLocale(locale);
  const t = await getTranslations('legal.privacy');
  if (!hasLocale(routing.locales, locale)) notFound();
  const appLocale = locale as AppLocale;

  return (
    <LegalPageLayout>
      <header style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
            fontSize: 36,
            fontWeight: 600,
            letterSpacing: '-0.5px',
            margin: '0 0 8px',
            color: '#1f2937',
          }}
        >
          {t('title')}
        </h1>
        <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>{t('updated')}</p>
      </header>
      <LegalArticle>
        <PrivacyContent locale={appLocale} />
      </LegalArticle>
    </LegalPageLayout>
  );
}
