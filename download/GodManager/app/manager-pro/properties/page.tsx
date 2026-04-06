import dynamic from 'next/dynamic';

const PropertiesClient = dynamic(() => import('./PropertiesClient'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--cream)] text-sm text-[var(--ink2)]">
      A carregar Properties…
    </div>
  ),
});

export default function PropertiesPage() {
  return <PropertiesClient />;
}
