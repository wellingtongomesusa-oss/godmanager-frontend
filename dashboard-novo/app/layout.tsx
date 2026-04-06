import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'GodCRM',
  description: 'GodCRM — painel administrativo.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="pt" className={inter.variable}>
      <body className={`${inter.variable} font-sans antialiased min-h-screen min-w-0 text-secondary-900 overflow-x-hidden`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
