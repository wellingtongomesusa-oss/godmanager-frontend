import { setRequestLocale } from 'next-intl/server';
import SuccessClient from './success-client';

type Props = { params: { locale: string } };

export default async function BillingSuccessPage({ params: { locale } }: Props) {
  setRequestLocale(locale);
  return <SuccessClient />;
}
