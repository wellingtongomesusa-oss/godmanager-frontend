'use client';

import { useMemo, useState } from 'react';
import Papa from 'papaparse';
import { Bar, Doughnut } from 'react-chartjs-2';
import { csvCell, csvMoney } from '@/lib/manager-pro/csvCell';

function excludeSource(raw: string): boolean {
  const s = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return false;
  if (s.includes('blacked out')) return true;
  if (s.includes('ogr/te')) return true;
  if (s === 'own') return true;
  if (s === 'mnt') return true;
  return false;
}

function monthKeyFromArrival(r: Record<string, string>): string {
  const dStr = csvCell(
    r,
    'Arrival Date',
    'Arrival date',
    'Arrival',
    'Check-in',
    'Check In',
    'Start Date',
    'ArrivalDate'
  );
  const d = new Date(dStr);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Ref. DataGrid (~5.732 linhas após exclusões): unidades só onde o relatório lista; resto destaca ticket */
const DEMO_AGENCIES: Record<string, { res: number; rev: number; units: number | null }> = {
  'RED/AIR': { res: 3195, rev: 4334371, units: 801 },
  'GRN/AIR': { res: 1540, rev: 2393537, units: 574 },
  TSG: { res: 116, rev: 447125, units: null },
  WEB: { res: 81, rev: 410924, units: null },
  WTS: { res: 75, rev: 380334, units: null },
};

/** Demo: quebra fictícia por unidade para o accordion (RED/GRN); CSV real substitui */
function demoByUnitSplit(source: string, d: { res: number; rev: number; units: number | null }) {
  const m = new Map<string, { qtd: number; rev: number }>();
  if (d.units == null || d.res <= 0) return m;
  const slices = 6;
  const baseQ = Math.floor(d.res / slices);
  let remQ = d.res;
  let remRev = d.rev;
  for (let i = 0; i < slices; i++) {
    const qtd = i === slices - 1 ? remQ : baseQ;
    const rev = i === slices - 1 ? remRev : Math.round((d.rev * qtd) / d.res);
    remQ -= qtd;
    remRev -= rev;
    m.set(`${source} · pool ${i + 1}`, { qtd, rev });
  }
  return m;
}

export default function ReservationsPage() {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [monthFilter, setMonthFilter] = useState('');
  const [agencyFilter, setAgencyFilter] = useState('');
  const [search, setSearch] = useState('');
  const [openAgency, setOpenAgency] = useState<string | null>(null);

  const baseFiltered = useMemo(() => {
    if (!rows.length) return [];
    return rows.filter((r) => {
      const src = csvCell(r, 'Source', 'source', 'Agency', 'Channel');
      return !excludeSource(src);
    });
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows.length) return [];
    return baseFiltered.filter((r) => {
      const mk = monthKeyFromArrival(r);
      if (monthFilter && mk !== monthFilter) return false;
      const src = csvCell(r, 'Source', 'source', 'Agency', 'Channel');
      if (agencyFilter && src !== agencyFilter && !src.toLowerCase().includes(agencyFilter.toLowerCase())) return false;
      if (search) {
        const q = search.toLowerCase();
        const blob = [
          csvCell(r, 'Guest', 'guest'),
          csvCell(r, 'Unit', 'unit', 'Property', 'Listing'),
          src,
        ]
          .join(' ')
          .toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [rows, baseFiltered, monthFilter, agencyFilter, search]);

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of baseFiltered) {
      const k = monthKeyFromArrival(r);
      if (k) set.add(k);
    }
    return [...set].sort().reverse();
  }, [baseFiltered]);

  const kpis = useMemo(() => {
    if (!filtered.length && !rows.length) {
      const res = Object.values(DEMO_AGENCIES).reduce((s, x) => s + x.res, 0);
      const rev = Object.values(DEMO_AGENCIES).reduce((s, x) => s + x.rev, 0);
      return { res, rev, ticket: rev / res, live: res };
    }
    let rev = 0;
    for (const r of filtered) {
      rev += csvMoney(
        csvCell(r, 'Revenue', 'revenue', 'Total', 'Amount', 'Gross', 'Booking total', 'Total Revenue')
      );
    }
    const n = filtered.length;
    return { res: n, rev, ticket: n ? rev / n : 0, live: n };
  }, [filtered, rows.length]);

  type Agg = {
    source: string;
    res: number;
    rev: number;
    units: Set<string>;
    byUnit: Map<string, { qtd: number; rev: number }>;
  };

  const byAgency = useMemo(() => {
    if (!filtered.length && !rows.length) {
      const map = new Map<string, Agg>();
      for (const [source, d] of Object.entries(DEMO_AGENCIES)) {
        const byUnit = demoByUnitSplit(source, d);
        const unitSet =
          d.units != null
            ? new Set(Array.from({ length: Math.min(d.units, 24) }, (_, i) => `Unidade demo ${i + 1}`))
            : new Set<string>();
        map.set(source, {
          source,
          res: d.res,
          rev: d.rev,
          units: unitSet,
          byUnit,
        });
      }
      return map;
    }
    const map = new Map<string, Agg>();
    for (const r of filtered) {
      const source = csvCell(r, 'Source', 'source', 'Agency', 'Channel') || '—';
      const unit = csvCell(r, 'Unit', 'unit', 'Property', 'Listing', 'Unit Name') || '—';
      const rev = csvMoney(
        csvCell(r, 'Revenue', 'revenue', 'Total', 'Amount', 'Gross', 'Booking total', 'Total Revenue')
      );
      if (!map.has(source)) {
        map.set(source, { source, res: 0, rev: 0, units: new Set(), byUnit: new Map() });
      }
      const a = map.get(source)!;
      a.res++;
      a.rev += rev;
      if (unit && unit !== '—') a.units.add(unit);
      const bu = a.byUnit.get(unit) ?? { qtd: 0, rev: 0 };
      bu.qtd++;
      bu.rev += rev;
      a.byUnit.set(unit, bu);
    }
    return map;
  }, [filtered, rows.length]);

  const topAgencies = useMemo(() => {
    return [...byAgency.values()].sort((a, b) => b.rev - a.rev);
  }, [byAgency]);

  /** Totais da tabela de agências (para % representativo por linha) */
  const agencyTableTotals = useMemo(() => {
    const res = topAgencies.reduce((s, a) => s + a.res, 0);
    const rev = topAgencies.reduce((s, a) => s + a.rev, 0);
    return { res, rev };
  }, [topAgencies]);

  const donutRes = useMemo(() => {
    const slice = topAgencies.slice(0, 8);
    return { labels: slice.map((a) => a.source.slice(0, 12)), data: slice.map((a) => a.res) };
  }, [topAgencies]);

  const donutRev = useMemo(() => {
    const slice = topAgencies.slice(0, 8);
    return { labels: slice.map((a) => a.source.slice(0, 12)), data: slice.map((a) => a.rev) };
  }, [topAgencies]);

  const barTicket = useMemo(() => {
    const slice = topAgencies.slice(0, 12).filter((a) => a.res > 0);
    return {
      labels: slice.map((a) => a.source.slice(0, 10)),
      data: slice.map((a) => a.rev / a.res),
    };
  }, [topAgencies]);

  const topUnitsGlobal = useMemo(() => {
    const m = new Map<string, number>();
    const useRows = rows.length ? filtered : [];
    for (const r of useRows) {
      const u = csvCell(r, 'Unit', 'unit', 'Property', 'Listing') || '—';
      m.set(u, (m.get(u) ?? 0) + 1);
    }
    if (!m.size && !rows.length) {
      return [
        ['Champions Gate', 120],
        ['Storey Lake', 95],
        ['Windsor Hills', 88],
      ] as [string, number][];
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [filtered, rows.length]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--ink)]">Reservations & Agencies</h1>
        <p className="text-sm text-[var(--ink2)]">
          DataGrid CSV (~5.732 linhas; pode carregar 1+ ficheiros) · exclui Source:{' '}
          <strong>BLACKED OUT</strong>, <strong>OGR/TE</strong>, <strong>OWN</strong>, <strong>MNT</strong> · mês
          por <strong>Arrival Date</strong>
        </p>
      </div>

      <div className="flex flex-wrap gap-4 rounded-lg border border-[var(--border)] bg-[var(--cream)] p-4">
        <label className="text-xs font-medium">
          Adicionar CSV
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
                  setRows((prev) => [...prev, ...((res.data as Record<string, string>[]) || [])]),
              });
            }}
          />
        </label>
        <button
          type="button"
          className="self-end rounded border border-[var(--border)] bg-[var(--paper)] px-3 py-1 text-xs"
          onClick={() => setRows([])}
        >
          Limpar dados
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="mp-card p-4" style={{ ['--bar-color' as string]: 'var(--green)' }}>
          <p className="mp-label">Reservas (filtradas)</p>
          <p className="mp-value mt-2">{kpis.res.toLocaleString()}</p>
        </div>
        <div className="mp-card p-4" style={{ ['--bar-color' as string]: 'var(--amber)' }}>
          <p className="mp-label">Receita</p>
          <p className="mp-value mt-2">${kpis.rev.toLocaleString()}</p>
        </div>
        <div className="mp-card p-4" style={{ ['--bar-color' as string]: 'var(--blue)' }}>
          <p className="mp-label">Ticket médio</p>
          <p className="mp-value mt-2">${kpis.ticket.toFixed(0)}</p>
        </div>
        <div className="mp-card p-4" style={{ ['--bar-color' as string]: 'var(--ink)' }}>
          <p className="mp-label">Contagem em tempo real</p>
          <p className="mp-value mt-2">{kpis.live.toLocaleString()} linhas filtradas</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--cream)] p-3">
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="rounded border px-2 py-1 text-xs"
        >
          <option value="">Todos os meses (Arrival)</option>
          {monthOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          placeholder="Agência / Source"
          value={agencyFilter}
          onChange={(e) => setAgencyFilter(e.target.value)}
          className="min-w-[140px] rounded border px-2 py-1 text-xs"
        />
        <input
          placeholder="Busca (guest, unit…)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[180px] rounded border px-2 py-1 text-xs"
        />
        <span className="self-center text-xs font-medium text-[var(--ink)]">
          {kpis.live.toLocaleString()} linhas
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-56 rounded-lg border border-[var(--border)] bg-[var(--paper)] p-2">
          <p className="mb-1 text-center text-xs text-[var(--ink3)]">Donut — reservas por agência</p>
          <Doughnut
            data={{
              labels: donutRes.labels.length ? donutRes.labels : ['—'],
              datasets: [
                {
                  data: donutRes.data.length ? donutRes.data : [0],
                  backgroundColor: ['#c47b28', '#2d7252', '#22558c', '#7c3aed', '#b83030', '#0891b2', '#64748b', '#94a3b8'],
                },
              ],
            }}
            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }}
          />
        </div>
        <div className="h-56 rounded-lg border border-[var(--border)] bg-[var(--paper)] p-2">
          <p className="mb-1 text-center text-xs text-[var(--ink3)]">Donut — receita por agência</p>
          <Doughnut
            data={{
              labels: donutRev.labels.length ? donutRev.labels : ['—'],
              datasets: [
                {
                  data: donutRev.data.length ? donutRev.data : [0],
                  backgroundColor: ['#c47b28', '#2d7252', '#22558c', '#7c3aed', '#b83030', '#0891b2', '#64748b', '#94a3b8', '#cbd5e1'],
                },
              ],
            }}
            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }}
          />
        </div>
        <div className="h-52 rounded-lg border border-[var(--border)] bg-[var(--paper)] p-2">
          <Bar
            data={{
              labels: barTicket.labels,
              datasets: [{ label: 'Ticket médio $', data: barTicket.data, backgroundColor: '#22558c' }],
            }}
            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
          />
        </div>
        <div className="h-52 rounded-lg border border-[var(--border)] bg-[var(--paper)] p-2">
          <Bar
            data={{
              labels: topUnitsGlobal.map(([u]) => String(u).slice(0, 14)),
              datasets: [{ label: 'Qtd alugueres', data: topUnitsGlobal.map(([, n]) => n), backgroundColor: '#2d7252' }],
            }}
            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
          />
        </div>
      </div>

      <div className="mp-table-wrap">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr>
              <th className="p-2 text-left">Agência (Source)</th>
              <th className="p-2 text-right">Reservas</th>
              <th className="p-2 text-right">Receita</th>
              <th className="p-2 text-right">% do total</th>
              <th className="p-2 text-right">Unidades únicas</th>
              <th className="p-2 text-right">Ticket médio</th>
            </tr>
          </thead>
          <tbody>
            {topAgencies.map((a) => {
              const ticket = a.res ? a.rev / a.res : 0;
              const demo = DEMO_AGENCIES[a.source];
              const unitsCell =
                rows.length === 0 && demo
                  ? demo.units != null
                    ? demo.units.toLocaleString()
                    : '—'
                  : a.units.size > 0
                    ? a.units.size.toLocaleString()
                    : '—';
              const pctRes =
                agencyTableTotals.res > 0 ? (100 * a.res) / agencyTableTotals.res : null;
              const pctRev =
                agencyTableTotals.rev > 0 ? (100 * a.rev) / agencyTableTotals.rev : null;
              return (
                <tr key={a.source} className="border-t border-[var(--border)]">
                  <td className="p-2 font-medium">{a.source}</td>
                  <td className="p-2 text-right font-mono">{a.res.toLocaleString()}</td>
                  <td className="p-2 text-right font-mono">${a.rev.toLocaleString()}</td>
                  <td className="p-2 text-right font-mono text-[var(--ink2)]">
                    {pctRes == null ? (
                      '—'
                    ) : (
                      <span className="inline-block text-right leading-tight">
                        <span className="block">{pctRes.toFixed(1)}% res</span>
                        {pctRev != null ? (
                          <span className="block text-[11px] text-[var(--ink3)]">{pctRev.toFixed(1)}% rev</span>
                        ) : null}
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-right font-mono text-[var(--ink2)]">{unitsCell}</td>
                  <td className="p-2 text-right font-mono">${ticket.toFixed(0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-[var(--ink)]">Accordion por agência</p>
        {topAgencies.slice(0, 15).map((a) => {
          const ticket = a.res ? a.rev / a.res : 0;
          const units = [...a.byUnit.entries()].sort((x, y) => y[1].qtd - x[1].qtd);
          const demo = DEMO_AGENCIES[a.source];
          const accordionMeta =
            !rows.length && demo
              ? demo.units != null
                ? `${demo.units} unidades · ticket $${ticket.toFixed(0)}`
                : `${a.res} res · ticket $${ticket.toFixed(0)}`
              : `${a.units.size} unidades · ticket $${ticket.toFixed(0)}`;
          return (
            <div key={`acc-${a.source}`} className="rounded-lg border border-[var(--border)] bg-[var(--paper)]">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold"
                onClick={() => setOpenAgency(openAgency === a.source ? null : a.source)}
              >
                <span>{a.source}</span>
                <span className="text-xs font-normal text-[var(--ink3)]">{accordionMeta}</span>
              </button>
              {openAgency === a.source && (
                <div className="border-t border-[var(--border)] px-4 py-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="py-1 text-left">Unidade</th>
                        <th className="py-1 text-right">Qtd</th>
                        <th className="py-1 text-right">% agência</th>
                        <th className="py-1 text-right">Ticket médio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(units.length ? units : [['—', { qtd: a.res, rev: a.rev }]] as const).map(([u, x]) => {
                        const pctOfAgency = a.res > 0 ? (100 * x.qtd) / a.res : null;
                        return (
                          <tr key={String(u)} className="border-t border-[var(--border)]/50">
                            <td className="py-1">{String(u).slice(0, 40)}</td>
                            <td className="py-1 text-right font-mono">{x.qtd}</td>
                            <td className="py-1 text-right font-mono text-[var(--ink2)]">
                              {pctOfAgency != null ? `${pctOfAgency.toFixed(1)}%` : '—'}
                            </td>
                            <td className="py-1 text-right font-mono">${(x.rev / Math.max(x.qtd, 1)).toFixed(0)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!rows.length && (
        <p className="text-center text-xs text-[var(--ink3)]">
          Demo: RED/AIR 3.195 · $4.334.371 · 801 u. | GRN/AIR 1.540 · $2.393.537 · 574 u. | TSG / WEB / WTS com
          ticket médio. Carregue o DataGrid CSV para dados reais.
        </p>
      )}
    </div>
  );
}
