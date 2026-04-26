import { AuthByTokenClient } from './AuthByTokenClient';

export const metadata = {
  title: 'Acesso Demo | GodManager',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function AuthByTokenPage({
  searchParams,
}: {
  searchParams?: { t?: string };
}) {
  const token = (searchParams?.t || '').trim();
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f172a',
        color: '#fff',
        fontFamily: 'var(--font-inter, "DM Sans"), sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <AuthByTokenClient token={token} />
    </div>
  );
}
