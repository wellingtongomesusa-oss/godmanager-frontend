'use client';

import dynamic from 'next/dynamic';

const Doughnut = dynamic(
  () => import('react-chartjs-2').then((m) => m.Doughnut),
  {
    ssr: false,
    loading: () => <div className="h-20 w-20 shrink-0 rounded-md bg-[var(--cream)]" aria-hidden />,
  }
);

type Props = {
  data: number[];
  colors?: string[];
  empty?: boolean;
};

/**
 * Donut card: 80×80px · cutout 70% · sem legenda (Chart.js) — só no cliente (evita SSR/chunks).
 */
export function MiniDonut({
  data,
  colors = ['#c47b28', '#e2d9cc'],
  empty = false,
}: Props) {
  const d = empty || data.every((n) => n === 0) ? [1, 0] : data;
  const c = empty ? ['#cbd5e1', '#e2e8f0'] : colors;

  return (
    <div className="h-20 w-20 shrink-0" aria-hidden>
      <Doughnut
        data={{
          datasets: [
            {
              data: d,
              backgroundColor: c,
              borderWidth: 0,
            },
          ],
        }}
        options={{
          cutout: '70%',
          responsive: true,
          maintainAspectRatio: false,
          backgroundColor: 'transparent',
          plugins: {
            legend: { display: false },
            tooltip: { enabled: !empty },
          },
        }}
      />
    </div>
  );
}
