import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trabalhe conosco | Godroox',
  description: 'Junte-se à equipe Godroox. Envie seu currículo e entraremos em contato.',
};

export default function TrabalheConoscoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
