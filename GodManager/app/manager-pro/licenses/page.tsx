import dynamic from 'next/dynamic';

const LicensesClient = dynamic(() => import('./LicensesClient'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--cream)] text-sm text-[var(--ink2)]">
      A carregar Licenses…
    </div>
  ),
});

export default function LicensesPage() {
  return <LicensesClient />;
}
