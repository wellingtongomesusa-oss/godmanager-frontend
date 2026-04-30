import { setRequestLocale } from 'next-intl/server';
import { SavingsWizard } from '@/components/marketing/SavingsWizard';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { SiteHeader } from '@/components/landing/SiteHeader';

export default function SavingsPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);

  return (
    <>
      <SiteHeader active="savings" />
      <main style={{ paddingTop: 64 }}>
        <SavingsWizard />
      </main>
      <SiteFooter />
    </>
  );
}
