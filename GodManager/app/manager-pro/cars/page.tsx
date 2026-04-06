import dynamic from 'next/dynamic';

const CarsClient = dynamic(() => import('./CarsClient'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--cream)] text-sm text-[var(--ink2)]">
      A carregar Cars…
    </div>
  ),
});

export default function CarsPage() {
  return <CarsClient />;
}
