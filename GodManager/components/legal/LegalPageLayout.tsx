import { SiteHeader } from '@/components/landing/SiteHeader';
import { SiteFooter } from '@/components/marketing/SiteFooter';

const pageShell: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f8f4ec',
  color: '#1f2937',
  fontFamily: 'var(--font-inter, "DM Sans"), sans-serif',
  WebkitFontSmoothing: 'antialiased',
};

export function LegalPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={pageShell}>
      <SiteHeader active="home" />
      <main style={{ maxWidth: 820, margin: '0 auto', padding: '120px 32px 56px' }}>{children}</main>
      <SiteFooter />
    </div>
  );
}
