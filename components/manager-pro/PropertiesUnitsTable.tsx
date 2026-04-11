'use client';

import dynamic from 'next/dynamic';
import { Fragment, useCallback, useMemo, useState } from 'react';

const Bar = dynamic(() => import('react-chartjs-2').then((m) => m.Bar), {
  ssr: false,
  loading: () => <div className="h-40 w-full animate-pulse rounded bg-[var(--cream)]" aria-hidden />,
});
import {
  DEMO_PORTFOLIO,
  REF_DP_QUARTOS,
  unitMonthlySeries,
  type MergedPropertyRow,
  type ReservationAgg,
} from '@/lib/manager-pro/propertiesMerge';

function bedPillClass(b: number): string {
  if (b <= 3) return 'bg-blue-100 text-blue-900 ring-1 ring-blue-200';
  if (b <= 5) return 'bg-amber-100 text-amber-900 ring-1 ring-amber-200';
  if (b <= 7) return 'bg-green-100 text-green-900 ring-1 ring-green-200';
  return 'bg-red-100 text-red-900 ring-1 ring-red-200';
}

function rankCell(i: number) {
  if (i === 0) return <span className="whitespace-nowrap">🏆 1</span>;
  return <span>{i + 1}</span>;
}

type Props = {
  rows: MergedPropertyRow[];
  resByUnit: Map<string, ReservationAgg>;
  hasExcel: boolean;
  /** Texto para PDF/CSV (filtros) */
  filterSummary: string;
};

export function PropertiesUnitsTable({ rows, resByUnit, hasExcel, filterSummary }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = useCallback((unit: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(unit)) next.delete(unit);
      else next.add(unit);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpanded(new Set(rows.map((r) => r.unitName)));
  }, [rows]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  const maxDpVol = useMemo(() => Math.max(...rows.map((r) => r.dpVolume), 1), [rows]);

  const downloadCsv = () => {
    const header =
      'Rank,Unit,Community,Franchisee,Bedrooms,DP,DP_Volume,Reservations,Revenue_USD';
    const lines = rows.map((r, i) => {
      const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
      return [
        i + 1,
        esc(r.unitName),
        esc(r.community),
        esc(r.franchisee),
        r.bedrooms,
        r.dp,
        r.dpVolume,
        r.resCount,
        r.revenue.toFixed(2),
      ].join(',');
    });
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `properties_units_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const printPdf = () => window.print();

  if (!hasExcel) {
    return (
      <p className="text-sm text-[var(--ink3)]">Carregue o Excel (linha 1 ou pivot header=2) + DataGrid CSV.</p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <button
          type="button"
          className="rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-1.5 text-xs font-medium"
          onClick={expandAll}
        >
          Expandir tudo
        </button>
        <button
          type="button"
          className="rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-1.5 text-xs font-medium"
          onClick={collapseAll}
        >
          Colapsar tudo
        </button>
        <button
          type="button"
          className="rounded-lg border border-[var(--border)] bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-white"
          onClick={downloadCsv}
          disabled={!rows.length}
        >
          Download CSV
        </button>
        <button
          type="button"
          className="rounded-lg border border-[var(--border)] bg-[var(--cream)] px-3 py-1.5 text-xs font-medium"
          onClick={printPdf}
          disabled={!rows.length}
        >
          Download PDF (impressão)
        </button>
        <span className="text-[11px] text-[var(--ink3)]">{filterSummary}</span>
      </div>

      <div className="mp-table-wrap max-h-[640px] overflow-auto print:hidden">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="sticky top-0 z-[1] bg-[var(--paper)]">
            <tr>
              <th className="p-2 text-left">
                Rank <span aria-hidden>🏆</span>
              </th>
              <th className="p-2 w-10 text-center">Expand</th>
              <th className="p-2 text-left">Casa</th>
              <th className="p-2 text-center">Quartos</th>
              <th className="p-2 text-center">DP</th>
              <th className="p-2 text-left min-w-[160px]">DP Volume</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const pct = Math.min(100, (r.dpVolume / maxDpVol) * 100);
              const open = expanded.has(r.unitName);
              const months = unitMonthlySeries(r.unitName, resByUnit);
              return (
                <Fragment key={r.unitName}>
                  <tr className="border-t border-[var(--border)]">
                    <td className="p-2 font-mono text-xs">{rankCell(i)}</td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        className="rounded p-1 text-[var(--ink2)] hover:bg-[var(--cream)]"
                        onClick={() => toggle(r.unitName)}
                        aria-expanded={open}
                      >
                        {open ? '▼' : '▶'}
                      </button>
                    </td>
                    <td className="p-2 max-w-[260px]">
                      <p className="font-medium leading-snug text-[var(--ink)]">{r.unitName}</p>
                      <p className="text-[11px] text-[var(--ink2)]">{r.community}</p>
                      <p className="text-[11px] text-[var(--ink3)]">{r.franchisee}</p>
                    </td>
                    <td className="p-2 text-center">
                      <span
                        className={`inline-flex min-w-[2.25rem] justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${bedPillClass(r.bedrooms)}`}
                      >
                        {r.bedrooms}Q
                      </span>
                    </td>
                    <td className="p-2 text-center">
                      <span className="inline-block rounded-md border border-[var(--amber-bd)] bg-[var(--amber-bg)] px-2 py-0.5 font-mono text-xs font-bold text-[var(--amber)]">
                        DP {r.dp}
                      </span>
                    </td>
                    <td className="p-2 align-middle">
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 font-mono text-xs">{r.dpVolume.toLocaleString()}</span>
                        <div className="h-2 min-w-[72px] flex-1 overflow-hidden rounded-full bg-[var(--cream)] ring-1 ring-[var(--border)]">
                          <div
                            className="h-full rounded-full bg-[var(--amber)] transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-t border-[var(--border)]/60 bg-[var(--sand)]/80">
                      <td colSpan={6} className="p-4">
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="text-xs">
                            <p className="font-semibold text-[var(--ink)]">Info · reservas</p>
                            <ul className="mt-2 space-y-1 text-[var(--ink2)]">
                              <li>
                                Reservas (período filtrado): <strong>{r.resCount}</strong>
                              </li>
                              <li>
                                Faturamento: <strong className="font-mono">${r.revenue.toLocaleString()}</strong>
                              </li>
                              <li>Franchisee: {r.franchisee}</li>
                              <li>Community: {r.community}</li>
                            </ul>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-[var(--ink)]">Receita por mês (DataGrid)</p>
                            {months.length === 0 ? (
                              <p className="mt-2 text-xs text-[var(--ink3)]">Sem dados por mês para esta unidade.</p>
                            ) : (
                              <div className="mt-2 h-36">
                                <Bar
                                  data={{
                                    labels: months.map((m) => m.month),
                                    datasets: [
                                      {
                                        label: '$',
                                        data: months.map((m) => m.revenue),
                                        backgroundColor: 'rgba(196, 123, 40, 0.75)',
                                      },
                                    ],
                                  }}
                                  options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: { legend: { display: false } },
                                    scales: {
                                      x: { ticks: { maxRotation: 45, font: { size: 9 } } },
                                      y: { ticks: { font: { size: 9 } } },
                                    },
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Impressão PDF — mesma tabela simplificada */}
      <div className="hidden print:block print:p-4">
        <h1 className="text-base font-bold text-black">Properties — Unidades</h1>
        <p className="text-xs text-gray-600">{filterSummary}</p>
        <table className="mt-3 w-full border-collapse border border-gray-400 text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 p-1">#</th>
              <th className="border border-gray-400 p-1 text-left">Casa</th>
              <th className="border border-gray-400 p-1">Q</th>
              <th className="border border-gray-400 p-1">DP</th>
              <th className="border border-gray-400 p-1">DP Vol</th>
              <th className="border border-gray-400 p-1">Res</th>
              <th className="border border-gray-400 p-1">$</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`p-${r.unitName}`}>
                <td className="border border-gray-400 p-1 text-center">{i + 1}</td>
                <td className="border border-gray-400 p-1">{r.unitName}</td>
                <td className="border border-gray-400 p-1 text-center">{r.bedrooms}</td>
                <td className="border border-gray-400 p-1 text-center">{r.dp}</td>
                <td className="border border-gray-400 p-1 text-right">{r.dpVolume}</td>
                <td className="border border-gray-400 p-1 text-center">{r.resCount}</td>
                <td className="border border-gray-400 p-1 text-right">{r.revenue.toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PortfolioKpiStrip(props: {
  hasExcel: boolean;
  dpTotal: number;
  dpVolume: number;
  revenue: number;
  activeUnits: number;
  totalUnits: number;
}) {
  const { hasExcel, dpTotal, dpVolume, revenue, activeUnits, totalUnits } = props;
  const d = !hasExcel ? DEMO_PORTFOLIO : null;
  const dt = d?.dpTotal ?? dpTotal;
  const dv = d?.dpVolume ?? dpVolume;
  const rev = d?.revenue ?? revenue;
  const au = d?.activeUnits ?? activeUnits;
  const tu = d?.totalUnits ?? totalUnits;

  const cards = [
    { k: 'DP Total', v: dt.toLocaleString(), bar: 'var(--amber)' as const },
    { k: 'DP Volume', v: dv.toLocaleString(), bar: 'var(--ink)' as const },
    { k: 'Faturamento', v: `$${rev.toLocaleString()}`, bar: 'var(--green)' as const },
    { k: 'Unidades ativas', v: `${au} de ${tu}`, bar: 'var(--blue)' as const },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.k}
          className="mp-card relative overflow-hidden p-4"
          style={{ ['--bar-color' as string]: c.bar }}
        >
          <p className="mp-label">{c.k}</p>
          <p className="mp-value mt-2">{c.v}</p>
          {!hasExcel && <p className="mp-card-sub2 mt-1">Ref. portfólio (carregue ficheiros)</p>}
        </div>
      ))}
    </div>
  );
}

export function RefDpStrip() {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--cream)] p-3">
      <p className="mp-label mb-2">Ref. DP (Bedrooms × 10 + 9)</p>
      <div className="flex flex-wrap gap-2">
        {REF_DP_QUARTOS.map(({ label, dp }) => (
          <span
            key={label}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--amber-bd)] bg-[var(--amber-bg)] px-2 py-1 font-mono text-[10px] font-semibold text-[var(--amber)]"
          >
            {label} → DP ${dp}
          </span>
        ))}
      </div>
      <p className="mp-card-sub2 mt-2">
        DP Volume = DP × reservas da unidade (no período filtrado)
      </p>
    </div>
  );
}
