import type { Metadata } from 'next';
import { Cormorant_Garamond, DM_Sans, Inter, JetBrains_Mono, Playfair_Display } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-cormorant',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'GodManager | Financial Operations',
  description: 'Trust bookkeeping, daily reconciliation, and compliance for property management brokerages.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${dmSans.variable} ${jetbrains.variable} ${playfair.variable} ${inter.variable}`}
    >
      <body className="min-h-screen font-body antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
