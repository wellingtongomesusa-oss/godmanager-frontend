import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Request Service',
  description: 'Request information about our services: life insurance, Florida LLC formation, or international payments.',
};

export default function RequestServiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
