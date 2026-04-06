import {
  InvoiceNav,
  InvoiceHero,
  InvoiceFeatureCards,
  InvoiceFooter,
} from '@/components/invoice-tool';

export default function Home() {
  return (
    <>
      <InvoiceNav />
      <InvoiceHero />
      <InvoiceFeatureCards />
      <InvoiceFooter />
    </>
  );
}
