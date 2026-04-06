import { Cormorant_Garamond, DM_Sans } from 'next/font/google';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans-inv',
  display: 'swap',
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-cormorant-inv',
  display: 'swap',
});

export default function InvoicesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${dmSans.variable} ${cormorant.variable}`}>{children}</div>
  );
}
