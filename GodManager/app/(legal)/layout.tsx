import Footer from '@/components/site/Footer';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Footer />
    </>
  );
}
