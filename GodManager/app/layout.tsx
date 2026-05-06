import type { Metadata, Viewport } from 'next';
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
  metadataBase: new URL('https://www.godmanager.us'),
  title: 'GodManager | Financial Operations',
  description: 'Trust bookkeeping, daily reconciliation, and compliance for property management brokerages.',
  icons: {
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'GodManager',
  },
  openGraph: {
    title: 'GodManager — Property Management Software',
    description:
      "If you don't know your numbers, you don't know your business. Modern property management for owners, vendors, and tenants.",
    url: 'https://www.godmanager.us',
    siteName: 'GodManager',
    locale: 'en_US',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'GodManager' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GodManager — Property Management Software',
    description: "If you don't know your numbers, you don't know your business.",
    images: ['/og-image.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
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
