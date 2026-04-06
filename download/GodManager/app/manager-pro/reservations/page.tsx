import dynamic from 'next/dynamic';

/**
 * Chart.js / react-chartjs-2 no servidor pode gerar chunks webpack inconsistentes
 * ("Cannot find module './844.js'"). Carregar só no cliente evita isso.
 */
const ReservationsClient = dynamic(() => import('./ReservationsClient'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--cream)] text-sm text-[var(--ink2)]">
      A carregar Reservations &amp; Agencies…
    </div>
  ),
});

export default function ReservationsPage() {
  return <ReservationsClient />;
}
