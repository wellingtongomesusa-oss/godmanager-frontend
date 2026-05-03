import { setRequestLocale } from 'next-intl/server';
import ExpiredClient from './expired-client';

type Props = { params: { locale: string } };

export default async function BillingExpiredPage({ params: { locale } }: Props) {
  setRequestLocale(locale);
  return <ExpiredClient />;
}
