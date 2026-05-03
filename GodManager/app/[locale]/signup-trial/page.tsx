import { getTranslations, setRequestLocale } from 'next-intl/server';
import SignupTrialClient from './signup-trial-client';

type PageProps = { params: { locale: string } };

export async function generateMetadata({ params: { locale } }: PageProps) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'signupTrial' });
  return {
    title: `GodManager — ${t('metaTitle')}`,
    description: t('metaDescription'),
  };
}

export default async function SignupTrialPage({ params: { locale } }: PageProps) {
  setRequestLocale(locale);
  return <SignupTrialClient />;
}
