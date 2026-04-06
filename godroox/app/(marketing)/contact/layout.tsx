import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contato | Godroox',
  description: 'Entre em contato com a Godroox. E-mail: contact@godroox.com | WhatsApp: +1 (321) 519-4710',
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
