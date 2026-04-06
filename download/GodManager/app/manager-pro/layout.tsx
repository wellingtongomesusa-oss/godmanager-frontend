import type { Metadata } from 'next';
import { Sora, JetBrains_Mono } from 'next/font/google';
import { ManagerProShell } from '@/components/manager-pro/Shell';
/* Garantir Tailwind + base antes do design system (evita página “sem CSS” no /manager-pro) */
import '../globals.css';
import './manager-pro.css';

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GodManager.One | Suite imobiliária',
  description: 'Sistema de Gestão Imobiliária Corporativa',
};

export default function ManagerProLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${sora.variable} ${jetbrains.variable} manager-pro-root`}
      style={{
        fontFamily: 'var(--font-sora), system-ui, sans-serif',
      }}
    >
      <ManagerProShell>{children}</ManagerProShell>
    </div>
  );
}
