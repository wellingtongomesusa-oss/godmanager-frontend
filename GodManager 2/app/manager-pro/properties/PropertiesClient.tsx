'use client';

import { useMemo, useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Bubble } from 'react-chartjs-2';
import {
  aggregateReservationsByUnit,
  bedroomBucket,
  countUnitsByBedroom,
  DEMO_TOP_COMMUNITY,
  DEMO_TOP_FRANCHISEE,
  mergePropertiesWithReservations,
  parsePropertiesExcelAuto,
  portfolioTotals,
  rollupByCommunity,
  rollupByFranchisee,
  type CommunityRollup,
  type MergedPropertyRow,
  type PropertyUnitRow,
} from '@/lib/manager-pro/propertiesMerge';
import { dpValue } from '@/lib/manager-pro/dpMerge';
import {
  PortfolioKpiStrip,
  PropertiesUnitsTable,
  RefDpStrip,
} from '@/components/manager-pro/PropertiesUnitsTable';
import { PropertiesPortfolioOnePanel } from '@/components/manager-pro/PropertiesPortfolioOnePanel';

const TABS = ['Propriedades', 'Condomínios', 'Franchisees'] as const;

const BED_ROW1: (number | 'all')[] = ['all', 2, 3, 4, 5, 6, 7, 8];
const BED_ROW2: number[] = [9, 10, 12, 15];

function rankMedal(i: number): string {
  if (i === 0) return '🥇';
  if (i === 1) return '🥈';
  if (i === 2) return '🥉';
  return '';
}

export default function PropertiesPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Propriedades');
  const [excelUnits, setExcelUnits] = useState<PropertyUnitRow[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [portfolioCsvRows, setPortfolioCsvRows] = useState<Record<string, string>[]>([]);
  const [excludeSources, setExcludeSources] = useState(true);
  const [monthFilter, setMonthFilter] = useState('');
  const [bedFilter, setBedFilter] = useState<number | 'all'>('all');
  const [openCommunity, setOpenCommunity] = useState<string | null>(null);

  const resByUnit = useMemo(
    () => aggregateReservationsByUnit(csvRows, { excludeSources }),
    [csvRows, excludeSources]
  );

  const monthOptions = useMemo(() => {
    const s = new Set<string>();
    for (const agg of resByUnit.values()) {
      for (const m of agg.byMonth.keys()) s.add(m);
    }
    return [...s].sort().reverse();
  }, [resByUnit]);

  /** Mês aplicado primeiro (AND com quartos) */
  const mergedAll = useMemo(
    () => mergePropertiesWithReservations(excelUnits, resByUnit, monthFilter || null),
    [excelUnits, resByUnit, monthFilter]
  );

  const merged = useMemo(() => {
    if (bedFilter === 'all') return mergedAll;
    return mergedAll.filter((r) => r.bedrooms === bedFilter);
  }, [mergedAll, bedFilter]);

  const bedCounts = useMemo(() => countUnitsByBedroom(mergedAll), [mergedAll]);

  const rankedUnits = useMemo(() => [...merged].sort((a, b) => b.revenue - a.revenue), [merged]);

  const kpiSums = useMemo(() => portfolioTotals(merged), [merged]);
  const catalogMeta = useMemo(
    () => ({
      total: mergedAll.length,
      active: mergedAll.filter((r) => r.resCount > 0).length,
    }),
    [mergedAll]
  );

  const filterSummary = useMemo(
    () =>
      [
        monthFilter ? `Mês: ${monthFilter}` : 'Mês: todos',
        bedFilter === 'all' ? 'Quartos: todos' : `Quartos: ${bedFilter}Q`,
        excludeSources ? 'Exclui BLACKED/OGR/OWN/MNT' : 'Sources: todas',
      ].join(' · '),
    [monthFilter, bedFilter, excludeSources]
  );

  const communities = useMemo(() => rollupByCommunity(merged), [merged]);
  const franchisees = useMemo(() => rollupByFranchisee(merged), [merged]);

  const portfolioBuckets = useMemo(() => {
    const buckets: Record<string, { units: number; revenue: number; res: number }> = {
      '1–3': { units: 0, revenue: 0, res: 0 },
      '4': { units: 0, revenue: 0, res: 0 },
      '5': { units: 0, revenue: 0, res: 0 },
      '6+': { units: 0, revenue: 0, res: 0 },
    };
    for (const r of merged) {
      const key = bedroomBucket(r.bedrooms);
      buckets[key].units += 1;
      buckets[key].revenue += r.revenue;
      buckets[key].res += r.resCount;
    }
    return buckets;
  }, [merged]);

  const bubbleChartData = useMemo(() => {
    const slice = communities.slice(0, 45);
    const maxDp = slice.length ? Math.max(...slice.map((c) => c.dpVolume), 1) : 1;
    return {
      datasets: [
        {
          label: 'Condomínios',
          data: slice.map((c) => ({
            x: c.unitCount,
            y: c.revenue,
            r: Math.max(5, Math.min(38, (c.dpVolume / maxDp) * 36)),
            _name: c.community,
            _dp: c.dpVolume,
            _res: c.resCount,
          })),
          backgroundColor: slice.map((_, i) => `hsla(${28 + (i * 17) % 280}, 55%, 48%, 0.55)`),
          borderColor: 'rgba(0,0,0,0.12)',
          borderWidth: 1,
        },
      ],
    };
  }, [communities]);

  const onExcel = (f: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]!];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
      setExcelUnits(parsePropertiesExcelAuto(rows));
    };
    reader.readAsArrayBuffer(f);
  };

  const bedButton = (b: number | 'all') => {
    const active = bedFilter === b;
    const count = b === 'all' ? mergedAll.length : bedCounts.get(b as number) ?? 0;
    const dp = b === 'all' ? null : dpValue(b as number);
    return (
      <button
        key={String(b)}
        type="button"
        onClick={() => setBedFilter(b === 'all' ? 'all' : b)}
        className={`flex min-w-[4.5rem] flex-col items-center rounded-lg border px-2 py-2 text-center transition ${
          active
            ? 'border-[var(--ink)] bg-[var(--ink)] text-white'
            : 'border-[var(--border)] bg-[var(--cream)] text-[var(--ink3)]'
        }`}
      >
        <span className="text-sm font-bold">{b === 'all' ? 'Todos' : b}</span>
        {b !== 'all' && (
          <>
            <span className={`mt-0.5 text-[10px] font-medium ${active ? 'text-white/90' : 'text-[var(--ink3)]'}`}>
              DP ${dp}
            </span>
            <span className={`text-[10px] ${active ? 'text-white/80' : 'text-[var(--ink3)]'}`}>{count} casas</span>
          </>
        )}
        {b === 'all' && (
          <span className={`mt-0.5 text-[10px] ${active ? 'text-white/80' : 'text-[var(--ink3)]'}`}>{count} casas</span>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--ink)]">Properties</h1>
        <p className="text-xs font-medium text-[var(--ink3)]">Painel GodManager.One · portfólio + DP / merge</p>
        <p className="text-sm text-[var(--ink2)]">
          <strong>Arquivo 1:</strong> Excel — <em>linha 1</em> (Unit Name, Bedrooms, Community, Franchisee) ou export pivot{' '}
          <em>header=2</em> (2 linhas vazias + «Row Labels» / «Sum of Bedrooms», ignorar Grand Total) ·{' '}
          <strong>Arquivo 2:</strong> DataGrid CSV · merge <strong>Unit Name = Unit</strong>
        </p>
        <p className="mt-1 text-xs text-[var(--ink3)]">
          <strong>DP</strong> = Bedrooms × 10 + 9 · Filtros <strong>mês + quartos em AND</strong> (não OR)
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--cream)] p-3 text-sm">
          <p className="font-semibold text-[var(--ink)]">Top Community (ref.)</p>
          <p className="mt-1 text-[var(--ink2)]">
            {DEMO_TOP_COMMUNITY.name} · <span className="font-mono">${DEMO_TOP_COMMUNITY.revenue.toLocaleString()}</span> ·{' '}
            {DEMO_TOP_COMMUNITY.units} un.
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--cream)] p-3 text-sm">
          <p className="font-semibold text-[var(--ink)]">Top Franchisee (ref.)</p>
          <p className="mt-1 text-[var(--ink2)]">
            {DEMO_TOP_FRANCHISEE.name} · <span className="font-mono">${DEMO_TOP_FRANCHISEE.revenue.toLocaleString()}</span> ·{' '}
            {DEMO_TOP_FRANCHISEE.units} un.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--paper)] p-3">
        <label className="text-xs font-semibold text-[var(--ink)]">
          0. Properties CSV — GodManager.One (todas as unidades)
          <input
            type="file"
            accept=".csv"
            className="mt-1 block text-[11px]"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              Papa.parse(f, {
                header: true,
                skipEmptyLines: true,
                complete: (res) => setPortfolioCsvRows((res.data as Record<string, string>[]) || []),
              });
            }}
          />
        </label>
      </div>

      <PropertiesPortfolioOnePanel
        csvRows={portfolioCsvRows}
        onClearCsv={() => setPortfolioCsvRows([])}
      />

      <div className="flex flex-wrap gap-4 rounded-lg border border-[var(--border)] bg-[var(--paper)] p-4">
        <label className="text-xs font-medium">
          1. Excel (.xlsx)
          <input type="file" accept=".xlsx,.xls" className="mt-1 block" onChange={(e) => e.target.files?.[0] && onExcel(e.target.files[0])} />
        </label>
        <label className="text-xs font-medium">
          2. DataGrid CSV
          <input
            type="file"
            accept=".csv"
            className="mt-1 block"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              Papa.parse(f, {
                header: true,
                skipEmptyLines: true,
                complete: (res) =>
                  setCsvRows((prev) => [...prev, ...((res.data as Record<string, string>[]) || [])]),
              });
            }}
          />
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input type="checkbox" checked={excludeSources} onChange={(e) => setExcludeSources(e.target.checked)} />
            Excluir Source: BLACKED OUT, OGR/TE, OWN, MNT
          </label>
          <button type="button" className="rounded border border-[var(--border)] px-2 py-1 text-xs" onClick={() => setCsvRows([])}>
            Limpar CSV
          </button>
          <button
            type="button"
            className="rounded border border-[var(--border)] px-2 py-1 text-xs"
            onClick={() => {
              setExcelUnits([]);
              setCsvRows([]);
              setPortfolioCsvRows([]);
            }}
          >
            Limpar tudo
          </button>
        </div>
      </div>

      <p className="text-xs text-[var(--ink3)]">
        Portfólio CSV: {portfolioCsvRows.length} linhas · Excel: {excelUnits.length} unidades · DataGrid CSV: {csvRows.length}{' '}
        linhas · merge: {rankedUnits.filter((r) => r.resCount > 0).length} unidades com reservas no filtro
      </p>

      <div className="flex gap-1 border-b border-[var(--border)]">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t ? 'border-b-2 border-[var(--amber)] text-[var(--ink)]' : 'text-[var(--ink3)]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--cream)] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[var(--ink)]">Mês (Arrival)</span>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="rounded border border-[var(--border)] bg-[var(--paper)] px-2 py-1.5 text-xs text-[var(--ink)]"
          >
            <option value="">Todos os meses</option>
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-[var(--ink3)]">
            + quartos abaixo = <strong className="text-[var(--ink2)]">AND</strong>
          </span>
        </div>
        <p className="text-[11px] font-medium text-[var(--ink2)]">Quartos (controlo principal)</p>
        <div className="flex flex-wrap gap-2">{BED_ROW1.map((b) => bedButton(b))}</div>
        <div className="flex flex-wrap gap-2">{BED_ROW2.map((b) => bedButton(b))}</div>
      </div>

      {tab === 'Propriedades' && (
        <div className="space-y-4">
          <div className="print:hidden space-y-4">
            <RefDpStrip />
            <PortfolioKpiStrip
              hasExcel={excelUnits.length > 0}
              dpTotal={kpiSums.dpTotal}
              dpVolume={kpiSums.dpVolume}
              revenue={kpiSums.revenue}
              activeUnits={catalogMeta.active}
              totalUnits={catalogMeta.total}
            />
          </div>
          <PropertiesUnitsTable
            rows={rankedUnits}
            resByUnit={resByUnit}
            hasExcel={excelUnits.length > 0}
            filterSummary={filterSummary}
          />
        </div>
      )}

      {tab === 'Condomínios' && (
        <div className="space-y-6">
          <div className="mp-table-wrap">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr>
                  <th className="p-2 text-left">Rank</th>
                  <th className="p-2 text-left">Condomínio</th>
                  <th className="p-2 text-right">Qtd</th>
                  <th className="p-2 text-left">S / M / L / XL</th>
                  <th className="p-2 text-right">DP Total</th>
                  <th className="p-2 text-right">Reservas</th>
                  <th className="p-2 text-right">Receita</th>
                  <th className="p-2 text-right">Ticket médio</th>
                </tr>
              </thead>
              <tbody>
                {communities.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-xs text-[var(--ink3)]">
                      Carregue Excel + CSV para ranking por condomínio.
                    </td>
                  </tr>
                )}
                {communities.map((c, i) => (
                  <CommunityTableRow key={c.community} c={c} rank={i + 1} />
                ))}
              </tbody>
            </table>
          </div>

          {communities.length > 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--paper)] p-4">
              <p className="mb-2 text-sm font-semibold text-[var(--ink)]">
                Bubble chart — Qtd unidades × Receita (raio ∝ DP Volume)
              </p>
              <div className="h-80 w-full max-w-4xl">
                <Bubble
                  data={bubbleChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (ctx) => {
                            const raw = ctx.raw as { _name?: string; x: number; y: number; r: number; _dp?: number; _res?: number };
                            const name = raw._name ?? '';
                            return [
                              name,
                              `Unidades: ${raw.x}`,
                              `Receita: $${Number(raw.y).toLocaleString()}`,
                              `DP Volume: ${raw._dp?.toLocaleString() ?? '—'}`,
                              `Reservas: ${raw._res ?? '—'}`,
                            ];
                          },
                        },
                      },
                    },
                    scales: {
                      x: {
                        title: { display: true, text: 'Qtd (unidades)' },
                        grid: { color: 'rgba(0,0,0,0.06)' },
                      },
                      y: {
                        title: { display: true, text: 'Receita ($)' },
                        grid: { color: 'rgba(0,0,0,0.06)' },
                      },
                    },
                  }}
                />
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-semibold text-[var(--ink)]">Breakdown faixas (portfolio filtrado)</p>
            <div className="mp-table-wrap max-w-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="p-2 text-left">Faixa quartos</th>
                    <th className="p-2 text-right">Unidades</th>
                    <th className="p-2 text-right">Reservas</th>
                    <th className="p-2 text-right">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {(['1–3', '4', '5', '6+'] as const).map((k) => (
                    <tr key={k} className="border-t border-[var(--border)]">
                      <td className="p-2">{k === '1–3' ? '1–3 quartos' : k === '6+' ? '6+ quartos' : `${k} quartos`}</td>
                      <td className="p-2 text-right font-mono">{portfolioBuckets[k].units}</td>
                      <td className="p-2 text-right font-mono">{portfolioBuckets[k].res}</td>
                      <td className="p-2 text-right font-mono">${portfolioBuckets[k].revenue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-[var(--ink)]">Accordion por condomínio</p>
            {communities.slice(0, 25).map((c) => (
              <div key={`acc-${c.community}`} className="rounded-lg border border-[var(--border)] bg-[var(--paper)]">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm font-medium"
                  onClick={() => setOpenCommunity(openCommunity === c.community ? null : c.community)}
                >
                  <span>{c.community}</span>
                  <span className="text-xs font-normal text-[var(--ink3)]">
                    ${c.revenue.toLocaleString()} · {c.unitCount} un. · ticket ${c.ticket.toFixed(0)}
                  </span>
                </button>
                {openCommunity === c.community && (
                  <div className="border-t border-[var(--border)] px-4 py-2">
                    <table className="w-full text-xs">
                      <thead>
                        <tr>
                          <th className="py-1 text-left">Faixa</th>
                          <th className="py-1 text-right">Unid.</th>
                          <th className="py-1 text-right">Receita</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(['1–3', '4', '5', '6+'] as const).map((fk) => {
                          const b = c.byBucket[fk];
                          const label = fk === '1–3' ? '1–3 q.' : fk === '6+' ? '6+ q.' : `${fk} q.`;
                          return (
                            <tr key={fk} className="border-t border-[var(--border)]/50">
                              <td className="py-1">{label}</td>
                              <td className="py-1 text-right font-mono">{b.units}</td>
                              <td className="py-1 text-right font-mono">${b.revenue.toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'Franchisees' && (
        <div className="mp-table-wrap">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left">#</th>
                <th className="p-2 text-left">Franchisee</th>
                <th className="p-2 text-right">Qtd unidades</th>
                <th className="p-2 text-right">Receita</th>
                <th className="p-2 text-right">Reservas</th>
                <th className="p-2 text-right">Média $ / unidade</th>
                <th className="p-2 text-right">Média res / unidade</th>
              </tr>
            </thead>
            <tbody>
              {franchisees.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-xs text-[var(--ink3)]">
                    Carregue Excel (coluna Franchisee) + CSV.
                  </td>
                </tr>
              )}
              {franchisees.map((f, i) => (
                <tr key={f.franchisee} className="border-t border-[var(--border)]">
                  <td className="p-2 font-mono text-xs">{i + 1}</td>
                  <td className="p-2 font-medium">{f.franchisee}</td>
                  <td className="p-2 text-right font-mono">{f.unitCount}</td>
                  <td className="p-2 text-right font-mono">${f.revenue.toLocaleString()}</td>
                  <td className="p-2 text-right font-mono">{f.resCount}</td>
                  <td className="p-2 text-right font-mono">${f.avgRevenuePerUnit.toFixed(0)}</td>
                  <td className="p-2 text-right font-mono">{f.avgResPerUnit.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CommunityTableRow({ c, rank }: { c: CommunityRollup; rank: number }) {
  const { sizes } = c;
  return (
    <tr className="border-t border-[var(--border)]">
      <td className="p-2 font-mono text-xs">
        <span className="mr-1">{rankMedal(rank - 1)}</span>
        {rank}
      </td>
      <td className="p-2 font-medium">{c.community}</td>
      <td className="p-2 text-right font-mono">{c.unitCount}</td>
      <td className="p-2 text-xs text-[var(--ink2)]">
        <span className="text-blue-800">S {sizes.small}</span>
        <span className="mx-1 text-[var(--ink3)]">·</span>
        <span className="text-amber-800">M {sizes.med}</span>
        <span className="mx-1 text-[var(--ink3)]">·</span>
        <span className="text-green-800">L {sizes.large}</span>
        <span className="mx-1 text-[var(--ink3)]">·</span>
        <span className="text-red-800">XL {sizes.xl}</span>
      </td>
      <td className="p-2 text-right font-mono">{c.dpInventoryTotal.toLocaleString()}</td>
      <td className="p-2 text-right font-mono">{c.resCount}</td>
      <td className="p-2 text-right font-mono">${c.revenue.toLocaleString()}</td>
      <td className="p-2 text-right font-mono">${c.ticket.toFixed(0)}</td>
    </tr>
  );
}

