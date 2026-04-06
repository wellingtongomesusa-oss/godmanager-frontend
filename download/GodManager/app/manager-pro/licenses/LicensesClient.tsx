'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import Link from 'next/link';
import {
  DEMO_CATEGORY,
  DEMO_RANKING,
  EMPTY_STATE_COPY,
  LICENSE_TOTAL,
  LICENSE_WARM,
  type LicenseRankRow,
  type LicenseStatus,
} from '@/lib/manager-pro/licensesModule';

const LicensesUsefulLinks = dynamic(
  () =>
    import('@/components/manager-pro/LicensesUsefulLinks').then((m) => ({
      default: m.LicensesUsefulLinks,
    })),
  {
    ssr: false,
    loading: () => <p className="text-sm text-[var(--ink3)]">Carregando links úteis…</p>,
  }
);

function statusPill(status: LicenseStatus) {
  const map = {
    ativa: { label: 'Ativa', className: 'bg-green-100 text-green-900 ring-green-200' },
    pendente: { label: 'Pendente', className: 'bg-amber-100 text-amber-900 ring-amber-200' },
    expirada: { label: 'Expirada', className: 'bg-red-100 text-red-900 ring-red-200' },
  } as const;
  const m = map[status];
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${m.className}`}>
      {m.label}
    </span>
  );
}

export default function LicensesPage() {
  const [demoEmpty, setDemoEmpty] = useState(false);

  const category = useMemo(
    () => (demoEmpty ? { ativas: 0, pendentes: 0, expiradas: 0 } : DEMO_CATEGORY),
    [demoEmpty]
  );
  const hasData = category.ativas + category.pendentes + category.expiradas > 0;

  const donutData = useMemo(() => {
    if (!hasData) {
      return {
        labels: ['Sem dados'],
        datasets: [
          {
            data: [1],
            backgroundColor: LICENSE_WARM.donutEmpty[0],
            borderWidth: 0,
          },
        ],
      };
    }
    return {
      labels: ['Ativas', 'Pendentes', 'Expiradas'],
      datasets: [
        {
          data: [category.ativas, category.pendentes, category.expiradas],
          backgroundColor: [LICENSE_WARM.ativa, LICENSE_WARM.pendente, LICENSE_WARM.expirada],
          borderWidth: 0,
        },
      ],
    };
  }, [hasData, category]);

  const barData = useMemo(() => {
    return {
      labels: ['Ativas', 'Pendentes', 'Expiradas'],
      datasets: [
        {
          label: 'Licenças',
          data: hasData ? [category.ativas, category.pendentes, category.expiradas] : [0, 0, 0],
          backgroundColor: hasData
            ? [LICENSE_WARM.ativa, LICENSE_WARM.pendente, LICENSE_WARM.expirada]
            : [LICENSE_WARM.donutEmpty[0], LICENSE_WARM.donutEmpty[0], LICENSE_WARM.donutEmpty[0]],
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    };
  }, [hasData, category]);

  const ranking: LicenseRankRow[] = demoEmpty ? [] : DEMO_RANKING;

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { font: { size: 11 }, color: '#4a5568' },
      },
    },
  };

  const barOpts = {
    ...chartOpts,
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#6b5c48', font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        ticks: { stepSize: 100, color: '#6b5c48' },
        grid: { color: 'rgba(226, 217, 204, 0.6)' },
      },
    },
  };

  return (
    <div className="space-y-6">
      <div
        className="rounded-lg border-2 border-[#2d7252] bg-[#ecfdf5] px-4 py-2 text-sm font-semibold text-[#14532d]"
        data-licenses-module="v1"
      >
        Módulo <strong>Licenças empresariais</strong> carregado — donut, barras, ranking e links úteis (SortableJS).
      </div>
      <div>
        <Link href="/manager-pro" className="text-xs text-[var(--amber)] hover:underline">
          ← Home
        </Link>
        <h1 className="mt-2 text-xl font-bold text-[var(--ink)]">Licenças empresariais</h1>
        <p className="mt-1 text-sm text-[var(--ink2)]">
          Participação por categoria · status · ranking · links úteis (SortableJS + localStorage)
        </p>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-[var(--ink3)]">
          <input type="checkbox" checked={demoEmpty} onChange={(e) => setDemoEmpty(e.target.checked)} />
          Ver estado vazio (donut cinza · sem linhas na tabela)
        </label>
      </div>

      {!hasData && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--cream)] px-4 py-3 text-sm text-[var(--ink2)]">
          <strong className="text-[var(--ink)]">Referência:</strong> {EMPTY_STATE_COPY}
        </div>
      )}

      {hasData && (
        <p className="text-xs text-[var(--ink3)]">
          Total de referência no portfólio: <strong className="text-[var(--ink)]">{LICENSE_TOTAL}</strong> licenças
          (ativas / pendentes / expiradas no gráfico).
        </p>
      )}

      {/* Row 2 col — gráficos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--paper)] p-4">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink3)]">
            Donut — Participação por Categoria
          </h2>
          <p className="mt-0.5 text-[11px] text-[var(--ink2)]">
            Ativas = verde · Pendentes = âmbar · Expiradas = vermelho
          </p>
          <div className="mx-auto mt-2 h-64 max-w-xs">
            <Doughnut data={donutData} options={{ ...chartOpts, cutout: '62%' }} />
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--paper)] p-4">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink3)]">
            Barras — Licenças por Status
          </h2>
          <p className="mt-0.5 text-[11px] text-[var(--ink2)]">Chart.js · paleta warm</p>
          <div className="mt-2 h-64">
            <Bar data={barData} options={barOpts} />
          </div>
        </div>
      </div>

      {/* 32px abaixo dos gráficos — Links úteis */}
      <LicensesUsefulLinks marginTopPx={32} />

      {/* Ranking */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--paper)] p-4">
        <h2 className="text-sm font-bold text-[var(--ink)]">Ranking de Licenças</h2>
        <div className="mp-table-wrap mt-3 max-h-[420px]">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="sticky top-0 bg-[var(--cream)]">
              <tr>
                <th className="p-2 text-left text-xs font-semibold text-[var(--ink2)]">#</th>
                <th className="p-2 text-left text-xs font-semibold text-[var(--ink2)]">Tipo</th>
                <th className="p-2 text-left text-xs font-semibold text-[var(--ink2)]">Status</th>
                <th className="p-2 text-right text-xs font-semibold text-[var(--ink2)]">Validade</th>
              </tr>
            </thead>
            <tbody>
              {ranking.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-xs text-[var(--ink3)]">
                    Sem linhas (estado vazio).
                  </td>
                </tr>
              )}
              {ranking.map((row, i) => (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="p-2 font-mono text-xs">{i + 1}</td>
                  <td className="p-2 font-medium text-[var(--ink)]">{row.tipo}</td>
                  <td className="p-2">{statusPill(row.status)}</td>
                  <td className="p-2 text-right font-mono text-xs text-[var(--ink2)]">{row.validade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
