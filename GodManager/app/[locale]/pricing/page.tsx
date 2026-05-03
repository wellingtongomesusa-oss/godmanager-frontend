import { getTranslations, setRequestLocale } from 'next-intl/server';
import PricingClient from './pricing-client';

type PageProps = { params: { locale: string } };

export async function generateMetadata({ params: { locale } }: PageProps) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'pricing' });
  return {
    title: `GodManager — ${t('metaTitle')}`,
    description: t('metaDescription'),
  };
}

export default async function PricingPage({ params: { locale } }: PageProps) {
  setRequestLocale(locale);
  return <PricingClient />;
}
