import { redirect } from 'next/navigation';

export default function PricingPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  redirect(`/${locale}/savings`);
}
