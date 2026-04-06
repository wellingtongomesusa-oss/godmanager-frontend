import dynamic from 'next/dynamic';

const HousekeeperClient = dynamic(() => import('./HousekeeperClient'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--cream)] text-sm text-[var(--ink2)]">
      A carregar Housekeeper…
    </div>
  ),
});

export default function HousekeeperPage() {
  return <HousekeeperClient />;
}
