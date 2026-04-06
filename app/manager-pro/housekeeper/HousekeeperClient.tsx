'use client';

import { useMemo, useState } from 'react';
import Papa from 'papaparse';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { csvCell, csvMoney } from '@/lib/manager-pro/csvCell';

const TYPE_ORDER = [
  'Standard (end of stay)',
  'Light clean',
  'Additional Clean',
  'Deep clean',
  'Mid stay clean',
  'Outros',
] as const;

function normalizeCleanType(raw: string): (typeof TYPE_ORDER)[number] {
  const x = raw.toLowerCase();
  if (x.includes('mid stay')) return 'Mid stay clean';
  if (x.includes('deep')) return 'Deep clean';
  if (x.includes('additional')) return 'Additional Clean';
  if (x.includes('light')) return 'Light clean';
  if (x.includes('standard') || x.includes('end of stay')) return 'Standard (end of stay)';
  if (!raw.trim()) return 'Outros';
  return 'Outros';
}

const DEMO_TYPES: Record<string, { n: number; $: number }> = {
  'Standard (end of stay)': { n: 2147, $: 324750 },
  'Light clean': { n: 70, $: 10380 },
  'Additional Clean': { n: 17, $: 2800 },
  'Deep clean': { n: 4, $: 700 },
  'Mid stay clean': { n: 1, $: 90 },
};

type HkRow = Record<string, string>;
/** Linha enriquecida (merge empresa + tipo + data); cast seguro sobre CSV string-only */
type EnrichedHk = HkRow & { _empresa: string; _type: (typeof TYPE_ORDER)[number]; _date: Date };

export default function HousekeeperPage() {
  const [hkRows, setHkRows] = useState<HkRow[]>([]);
  const [empRows, setEmpRows] = useState<Record<string, string>[]>([]);
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [filterCleaner, setFilterCleaner] = useState('');
  const [filterCommunity, setFilterCommunity] = useState('');
  const [filterType, setFilterType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [openEmpresa, setOpenEmpresa] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const cleanerToCompany = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of empRows) {
      const cl = csvCell(r, 'Cleaner', 'Housekeeper', 'cleaner', 'Nome Cleaner').toLowerCase();
      const co = csvCell(r, 'Company', 'Empresa', 'Company Name', 'Empresa / Company');
      if (cl && co) m.set(cl, co);
    }
    return m;
  }, [empRows]);

  const merged = useMemo((): EnrichedHk[] => {
    if (!hkRows.length) return [];
    return hkRows.map((r) => {
      const hkName = csvCell(r, 'Housekeeper', 'Cleaner', 'housekeeper').toLowerCase();
      const empresa =
        cleanerToCompany.get(hkName) ||
        csvCell(r, 'Company', 'Empresa', 'Empresa / Company') ||
        '—';
      const typeRaw = csvCell(r, 'Type', 'type', 'Tipo', 'Clean Type', 'Service Type');
      const dStr = csvCell(r, 'Date', 'date', 'Service Date', 'Clean Date', 'Scheduled');
      const d = dStr ? new Date(dStr) : new Date(NaN);
      return {
        ...r,
        _empresa: empresa,
        _type: normalizeCleanType(typeRaw),
        _date: d,
      } as EnrichedHk;
    });
  }, [hkRows, cleanerToCompany]);

  const filtered = useMemo((): EnrichedHk[] => {
    if (!merged.length) return [];
    return merged.filter((r) => {
      if (filterEmpresa && !String(r._empresa).toLowerCase().includes(filterEmpresa.toLowerCase())) return false;
      const cl = csvCell(r, 'Housekeeper', 'Cleaner').toLowerCase();
      if (filterCleaner && !cl.includes(filterCleaner.toLowerCase())) return false;
      const comm = csvCell(r, 'Community', 'community', 'Comunidade', 'Neighborhood').toLowerCase();
      if (filterCommunity && !comm.includes(filterCommunity.toLowerCase())) return false;
      if (filterType && r._type !== filterType) return false;
      const st = csvCell(r, 'Status', 'status').toLowerCase();
      if (statusFilter && !st.includes(statusFilter.toLowerCase())) return false;
      if (dateFrom && r._date && !Number.isNaN(r._date.getTime()) && r._date < new Date(dateFrom)) return false;
      if (dateTo && r._date && !Number.isNaN(r._date.getTime()) && r._date > new Date(dateTo + 'T23:59:59')) return false;
      return true;
    });
  }, [merged, filterEmpresa, filterCleaner, filterCommunity, filterType, dateFrom, dateTo, statusFilter]);

  const kpis = useMemo(() => {
    if (!filtered.length && !hkRows.length) {
      const types = DEMO_TYPES;
      const limpezas = Object.values(types).reduce((s, x) => s + x.n, 0);
      const valor = Object.values(types).reduce((s, x) => s + x.$, 0);
      return {
        empresas: 85,
        cleaners: 87,
        casas: 866,
        limpezas,
        valor,
        ticket: valor / limpezas,
        byType: types,
      };
    }
    const empresas = new Set(filtered.map((r) => r._empresa).filter(Boolean));
    const cleaners = new Set(
      filtered.map((r) => csvCell(r, 'Housekeeper', 'Cleaner')).filter(Boolean)
    );
    const casas = new Set(
      filtered.map((r) => csvCell(r, 'Unit', 'unit', 'Address', 'Property')).filter(Boolean)
    );
    let valor = 0;
    const byType: Record<string, { n: number; $: number }> = {};
    for (const r of filtered) {
      const amt = csvMoney(csvCell(r, 'Amount', 'amount', 'Total', 'Price', 'Cost'));
      valor += amt;
      const t = r._type || 'Outros';
      if (!byType[t]) byType[t] = { n: 0, $: 0 };
      byType[t].n++;
      byType[t].$ += amt;
    }
    const limpezas = filtered.length;
    return {
      empresas: empresas.size || 1,
      cleaners: cleaners.size || 1,
      casas: casas.size || 0,
      limpezas,
      valor,
      ticket: limpezas ? valor / limpezas : 0,
      byType,
    };
  }, [filtered, hkRows.length]);

  const tableAgg = useMemo(() => {
    const map = new Map<
      string,
      { empresa: string; cleaner: string; qtd: number; casas: Set<string>; total: number }
    >();
    const useRows = hkRows.length ? filtered : [];
    for (const r of useRows) {
      const cleaner = csvCell(r, 'Housekeeper', 'Cleaner') || '—';
      const empresa = r._empresa || '—';
      const key = `${empresa}||${cleaner}`;
      const unit = csvCell(r, 'Unit', 'unit', 'Address');
      const amt = csvMoney(csvCell(r, 'Amount', 'amount', 'Total', 'Price'));
      if (!map.has(key)) {
        map.set(key, { empresa, cleaner, qtd: 0, casas: new Set(), total: 0 });
      }
      const x = map.get(key)!;
      x.qtd++;
      if (unit) x.casas.add(unit);
      x.total += amt;
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered, hkRows.length]);

  const byEmpresaDetails = useMemo(() => {
    const m = new Map<string, EnrichedHk[]>();
    const useRows = hkRows.length ? filtered : merged;
    for (const r of useRows) {
      const e = r._empresa || '—';
      if (!m.has(e)) m.set(e, []);
      m.get(e)!.push(r);
    }
    return m;
  }, [filtered, merged, hkRows.length]);

  const communityAgg = useMemo(() => {
    const m = new Map<string, number>();
    const useRows = filtered.length ? filtered : merged;
    for (const r of useRows) {
      const c = csvCell(r, 'Community', 'community', 'Comunidade') || '—';
      m.set(c, (m.get(c) ?? 0) + csvMoney(csvCell(r, 'Amount', 'amount', 'Total')));
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [filtered, merged]);

  const cleanerRanking = useMemo(() => {
    const m = new Map<string, { qtd: number; total: number }>();
    const useRows = filtered.length ? filtered : merged;
    for (const r of useRows) {
      const c = csvCell(r, 'Housekeeper', 'Cleaner') || '—';
      const amt = csvMoney(csvCell(r, 'Amount', 'amount', 'Total'));
      if (!m.has(c)) m.set(c, { qtd: 0, total: 0 });
      const x = m.get(c)!;
      x.qtd++;
      x.total += amt;
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 15);
  }, [filtered, merged]);

  const lineByMonth = useMemo(() => {
    const m = new Map<string, number>();
    const useRows = filtered.length ? filtered : merged;
    for (const r of useRows) {
      if (!r._date || Number.isNaN(r._date.getTime())) continue;
      const key = `${r._date.getFullYear()}-${String(r._date.getMonth() + 1).padStart(2, '0')}`;
      m.set(key, (m.get(key) ?? 0) + csvMoney(csvCell(r, 'Amount', 'amount', 'Total')));
    }
    const keys = [...m.keys()].sort();
    return { labels: keys, data: keys.map((k) => m.get(k) ?? 0) };
  }, [filtered, merged]);

  const donutEmpresa = useMemo(() => {
    const m = new Map<string, number>();
    const useRows = filtered.length ? filtered : merged;
    for (const r of useRows) {
      const e = r._empresa || '—';
      m.set(e, (m.get(e) ?? 0) + csvMoney(csvCell(r, 'Amount', 'amount', 'Total')));
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [filtered, merged]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--ink)]">Housekeeper & Cleaners</h1>
        <p className="text-sm text-[var(--ink2)]">
          Housekeeper.csv + Cleaners_empresas.csv · merge <strong>Housekeeper = Cleaner</strong>
        </p>
      </div>

      <div className="flex flex-wrap gap-4 rounded-lg border border-[var(--border)] bg-[var(--cream)] p-4">
        <label className="text-xs font-medium">
          Housekeeper.csv
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
                complete: (res) => setHkRows((res.data as Record<string, string>[]) || []),
              });
            }}
          />
        </label>
        <label className="text-xs font-medium">
          Cleaners_empresas.csv
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
                complete: (res) => setEmpRows((res.data as Record<string, string>[]) || []),
              });
            }}
          />
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          ['Empresas', kpis.empresas],
          ['Cleaners', kpis.cleaners],
          ['Casas únicas', kpis.casas],
          ['Limpezas', kpis.limpezas],
          ['Valor total', `$${kpis.valor.toLocaleString()}`],
          ['Ticket médio', `$${kpis.ticket.toFixed(2)}`],
        ].map(([k, v]) => (
          <div key={String(k)} className="mp-card p-3" style={{ ['--bar-color' as string]: 'var(--green)' }}>
            <p className="mp-label">{k}</p>
            <p className="mp-value mt-1 text-lg">{v}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--paper)] p-4">
        <p className="mb-2 text-xs font-semibold text-[var(--ink2)]">Por tipo (ref. PDF)</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {TYPE_ORDER.filter((t) => t !== 'Outros').map((t) => {
            const x = (kpis.byType as Record<string, { n: number; $: number }>)[t] || DEMO_TYPES[t] || { n: 0, $: 0 };
            return (
              <div key={t} className="rounded border border-[var(--border)] bg-[var(--cream)] p-2 text-xs">
                <p className="font-semibold text-[var(--ink)]">{t}</p>
                <p>
                  {x.n.toLocaleString()} · ${x.$.toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-lg border border-[var(--border)] bg-[var(--cream)] p-3">
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded border px-2 py-1 text-xs"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded border px-2 py-1 text-xs"
        />
        <input
          placeholder="Empresa"
          value={filterEmpresa}
          onChange={(e) => setFilterEmpresa(e.target.value)}
          className="min-w-[120px] rounded border px-2 py-1 text-xs"
        />
        <input
          placeholder="Cleaner"
          value={filterCleaner}
          onChange={(e) => setFilterCleaner(e.target.value)}
          className="min-w-[120px] rounded border px-2 py-1 text-xs"
        />
        <input
          placeholder="Comunidade"
          value={filterCommunity}
          onChange={(e) => setFilterCommunity(e.target.value)}
          className="min-w-[120px] rounded border px-2 py-1 text-xs"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded border px-2 py-1 text-xs"
        >
          <option value="">Tipo (todos)</option>
          {TYPE_ORDER.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          placeholder="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="min-w-[100px] rounded border px-2 py-1 text-xs"
        />
        <span className="self-center text-xs text-[var(--ink3)]">
          {filtered.length} linhas (tempo real)
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-56 rounded-lg border border-[var(--border)] bg-[var(--paper)] p-2">
          <Doughnut
            data={{
              labels: donutEmpresa.map(([e]) => e.slice(0, 18)),
              datasets: [
                {
                  data: donutEmpresa.map(([, v]) => v),
                  backgroundColor: ['#c47b28', '#22558c', '#2d7252', '#b83030', '#7c3aed', '#ea580c', '#0891b2', '#64748b'],
                },
              ],
            }}
            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }}
          />
        </div>
        <div className="h-56 rounded-lg border border-[var(--border)] bg-[var(--paper)] p-2">
          <Bar
            data={{
              labels: communityAgg.map(([c]) => c.slice(0, 14)),
              datasets: [{ label: '$', data: communityAgg.map(([, v]) => v), backgroundColor: '#22558c' }],
            }}
            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
          />
        </div>
        <div className="h-56 rounded-lg border border-[var(--border)] bg-[var(--paper)] p-2 lg:col-span-2">
          <Line
            data={{
              labels: lineByMonth.labels.length ? lineByMonth.labels : ['—'],
              datasets: [
                {
                  label: 'Valor por mês',
                  data: lineByMonth.data.length ? lineByMonth.data : [0],
                  borderColor: '#c47b28',
                  backgroundColor: 'rgba(196,123,40,0.1)',
                  fill: true,
                },
              ],
            }}
            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
          />
        </div>
        <div className="h-64 rounded-lg border border-[var(--border)] bg-[var(--paper)] p-2 lg:col-span-2">
          <Bar
            data={{
              labels: cleanerRanking.map(([c]) => c.slice(0, 16)),
              datasets: [{ label: 'Total $', data: cleanerRanking.map(([, x]) => x.total), backgroundColor: '#2d7252' }],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              indexAxis: 'y' as const,
              plugins: { legend: { display: false } },
            }}
          />
        </div>
      </div>

      <div className="mp-table-wrap">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr>
              <th className="p-2 text-left">Empresa</th>
              <th className="p-2 text-left">Cleaner</th>
              <th className="p-2 text-right">Qtd</th>
              <th className="p-2 text-right">Casas únicas</th>
              <th className="p-2 text-right">Valor médio</th>
              <th className="p-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {tableAgg.map((row) => (
              <tr key={`${row.empresa}-${row.cleaner}`} className="border-t border-[var(--border)]">
                <td className="p-2">{row.empresa}</td>
                <td className="p-2">{row.cleaner}</td>
                <td className="p-2 text-right font-mono">{row.qtd}</td>
                <td className="p-2 text-right font-mono">{row.casas.size}</td>
                <td className="p-2 text-right font-mono">${(row.total / Math.max(row.qtd, 1)).toFixed(2)}</td>
                <td className="p-2 text-right font-mono">${row.total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-[var(--ink)]">Accordion por empresa</p>
        {[...byEmpresaDetails.entries()]
          .sort((a, b) => b[1].length - a[1].length)
          .slice(0, 20)
          .map(([emp, rows]) => (
            <div key={emp} className="rounded-lg border border-[var(--border)] bg-[var(--paper)]">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold"
                onClick={() => setOpenEmpresa(openEmpresa === emp ? null : emp)}
              >
                {emp} <span className="text-xs font-normal text-[var(--ink3)]">{rows.length} limpezas</span>
              </button>
              {openEmpresa === emp && (
                <div className="border-t border-[var(--border)] px-4 py-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="py-1 text-left">Casa/Unit</th>
                        <th className="py-1 text-left">Data</th>
                        <th className="py-1 text-left">Tipo</th>
                        <th className="py-1 text-left">Status</th>
                        <th className="py-1 text-right">$</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 100).map((r, i) => (
                        <tr key={i} className="border-t border-[var(--border)]/50">
                          <td className="py-1">{csvCell(r, 'Unit', 'unit', 'Address').slice(0, 40)}</td>
                          <td className="py-1 font-mono">
                            {r._date && !Number.isNaN(r._date.getTime())
                              ? r._date.toLocaleDateString()
                              : csvCell(r, 'Date', 'date')}
                          </td>
                          <td className="py-1">{r._type}</td>
                          <td className="py-1">{csvCell(r, 'Status', 'status') || '—'}</td>
                          <td className="py-1 text-right font-mono">
                            ${csvMoney(csvCell(r, 'Amount', 'amount', 'Total')).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
      </div>

      {!hkRows.length && (
        <p className="text-center text-xs text-[var(--ink3)]">
          Demo com totais do PDF (2.240 limpezas / tipos). Envie os 2 CSVs para dados reais.
        </p>
      )}
    </div>
  );
}
