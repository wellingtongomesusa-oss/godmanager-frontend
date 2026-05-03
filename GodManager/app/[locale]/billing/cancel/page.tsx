import { setRequestLocale } from 'next-intl/server';
import CancelClient from './cancel-client';

type Props = { params: { locale: string } };

export default async function BillingCancelPage({ params: { locale } }: Props) {
  setRequestLocale(locale);
  return <CancelClient />;
}
