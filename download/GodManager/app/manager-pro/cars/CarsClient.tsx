'use client';

import { useMemo, useState } from 'react';
import Papa from 'papaparse';
import { Bar, Doughnut } from 'react-chartjs-2';
import { csvCell } from '@/lib/manager-pro/csvCell';

type Car = { vin: string; insuranceDate: Date; row: Record<string, string> };

type StatusKind = 'valid' | 'soon' | 'expired';

function parseInsuranceDate(r: Record<string, string>): Date {
  const dStr = csvCell(r, 'Insurance Date', 'insurance_date', 'Insurance Expiration', 'Expiration');
  const d = new Date(dStr);
  return d;
}

function parseVin(r: Record<string, string>): string {
  return csvCell(r, 'VIN Number', 'VIN', 'vin', 'Vin').trim();
}

function dedupByVinLastDate(rows: Record<string, string>[]): Car[] {
  const parsed: Car[] = [];
  for (const row of rows) {
    const vin = parseVin(row);
    if (!vin) continue;
    const insuranceDate = parseInsuranceDate(row);
    parsed.push({ vin, insuranceDate, row });
  }
  parsed.sort((a, b) => a.insuranceDate.getTime() - b.insuranceDate.getTime());
  const byVin = new Map<string, Car>();
  for (const c of parsed) byVin.set(c.vin, c);
  return Array.from(byVin.values());
}

function statusOf(insuranceDate: Date, now: Date): StatusKind {
  const in30 = new Date(now.getTime() + 30 * 86400000);
  if (insuranceDate < now) return 'expired';
  if (insuranceDate < in30) return 'soon';
  return 'valid';
}

const OWNER_HIGHLIGHT = ['mvh cars one llc', 'master vacation homes', '1509 mulligan'];

export default function CarsPage() {
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [statusBanner, setStatusBanner] = useState<StatusKind | null>(null);
  const [insurerFilter, setInsurerFilter] = useState('');
  const [ownerQuick, setOwnerQuick] = useState('');

  const cars = useMemo(() => dedupByVinLastDate(rawRows), [rawRows]);

  const now = useMemo(() => new Date(), []);

  const filtered = useMemo(() => {
    return cars.filter((c) => {
      const st = statusOf(c.insuranceDate, now);
      if (statusBanner === 'expired' && st !== 'expired') return false;
      if (statusBanner === 'soon' && st !== 'soon') return false;
      if (statusBanner === 'valid' && st !== 'valid') return false;
      const ins = csvCell(c.row, 'Insurer', 'insurer', 'Insurance Company', 'Carrier').toLowerCase();
      if (insurerFilter === 'infinity' && !ins.includes('infinity')) return false;
      if (insurerFilter === 'geico' && !ins.includes('geico')) return false;
      const own = csvCell(c.row, 'Owner', 'owner', 'Registered Owner', 'Owner Name').toLowerCase();
      if (ownerQuick && !own.includes(ownerQuick.toLowerCase())) return false;
      return true;
    });
  }, [cars, statusBanner, insurerFilter, ownerQuick, now]);

  const displayList = filtered;

  const stats = useMemo(() => {
    const src = cars.length ? cars : demoCars();
    let exp = 0;
    let soon = 0;
    let ok = 0;
    for (const c of src) {
      const st = statusOf(c.insuranceDate, now);
      if (st === 'expired') exp++;
      else if (st === 'soon') soon++;
      else ok++;
    }
    return { total: src.length, exp, soon, ok };
  }, [cars, now]);

  const insurerAgg = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of displayList) {
      const k = csvCell(c.row, 'Insurer', 'insurer', 'Insurance Company', 'Carrier') || '—';
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [displayList]);

  const statusAgg = useMemo(() => {
    let exp = 0;
    let soon = 0;
    let ok = 0;
    for (const c of displayList) {
      const st = statusOf(c.insuranceDate, now);
      if (st === 'expired') exp++;
      else if (st === 'soon') soon++;
      else ok++;
    }
    return { exp, soon, ok };
  }, [displayList, now]);

  const ownerBars = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of displayList) {
      const o = csvCell(c.row, 'Owner', 'owner', 'Registered Owner') || '—';
      m.set(o, (m.get(o) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [displayList]);

  const makeBars = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of displayList) {
      const mk = csvCell(c.row, 'Make', 'make', 'Vehicle Make') || '—';
      m.set(mk, (m.get(mk) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [displayList]);

  const yearBars = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of displayList) {
      const y = csvCell(c.row, 'Year', 'year', 'Model Year') || '—';
      m.set(y, (m.get(y) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]))).slice(-12);
  }, [displayList]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--ink)]">Cars & Insurance</h1>
        <p className="text-sm text-[var(--ink2)]">
          2 CSVs (concat) · dedup <strong>VIN</strong> → mantém <strong>Insurance Date</strong> mais recente · Infinity +
          GEICO
        </p>
      </div>

      <div className="flex flex-wrap gap-4 rounded-lg border border-[var(--border)] bg-[var(--cream)] p-4">
        <label className="text-xs font-medium">
          CSV conta 1
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
                  setRawRows((prev) => [...prev, ...((res.data as Record<string, string>[]) || [])]),
              });
            }}
          />
        </label>
        <label className="text-xs font-medium">
          CSV conta 2
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
                  setRawRows((prev) => [...prev, ...((res.data as Record<string, string>[]) || [])]),
              });
            }}
          />
        </label>
        <button
          type="button"
          className="self-end rounded border border-[var(--border)] bg-[var(--paper)] px-3 py-1 text-xs"
          onClick={() => setRawRows([])}
        >
          Limpar linhas carregadas
        </button>
      </div>

      <p className="text-sm text-[var(--ink2)]">
        VINs únicos: <strong>{cars.length || 67}</strong> (demo 67 sem CSV)
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStatusBanner((s) => (s === 'expired' ? null : 'expired'))}
          className={`cursor-pointer rounded-lg border-2 px-4 py-2 text-left text-sm font-medium transition ${
            statusBanner === 'expired'
              ? 'border-[var(--red)] bg-red-50'
              : 'border-transparent bg-red-100 text-[var(--red)]'
          }`}
        >
          Expirado (Insurance Date &lt; hoje): {stats.exp}
        </button>
        <button
          type="button"
          onClick={() => setStatusBanner((s) => (s === 'soon' ? null : 'soon'))}
          className={`cursor-pointer rounded-lg border-2 px-4 py-2 text-left text-sm font-medium transition ${
            statusBanner === 'soon'
              ? 'border-amber-500 bg-amber-50'
              : 'border-transparent bg-amber-100 text-amber-800'
          }`}
        >
          Expira em 30 dias: {stats.soon}
        </button>
        <button
          type="button"
          onClick={() => setStatusBanner((s) => (s === 'valid' ? null : 'valid'))}
          className={`cursor-pointer rounded-lg border-2 px-4 py-2 text-left text-sm font-medium transition ${
            statusBanner === 'valid'
              ? 'border-[var(--green)] bg-green-50'
              : 'border-transparent bg-green-100 text-[var(--green)]'
          }`}
        >
          Válido: {stats.ok}
        </button>
        <button
          type="button"
          onClick={() => {
            setInsurerFilter((x) => (x === 'infinity' ? '' : 'infinity'));
            setOwnerQuick('');
          }}
          className="rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-xs font-medium"
        >
          Filtro: Infinity
        </button>
        <button
          type="button"
          onClick={() => {
            setInsurerFilter((x) => (x === 'geico' ? '' : 'geico'));
            setOwnerQuick('');
          }}
          className="rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-xs font-medium"
        >
          Filtro: GEICO
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-[var(--ink3)]">Proprietários (atalho):</span>
        {OWNER_HIGHLIGHT.map((o) => (
          <button
            key={o}
            type="button"
            className="rounded border border-[var(--border)] bg-[var(--cream)] px-2 py-1 text-xs"
            onClick={() => {
              setOwnerQuick((cur) => (cur === o ? '' : o));
              setInsurerFilter('');
            }}
          >
            {o}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-56 rounded-lg border border-[var(--border)] bg-[var(--paper)] p-2">
          <Doughnut
            data={{
              labels: insurerAgg.map(([k]) => k.slice(0, 14)),
              datasets: [
                {
                  data: insurerAgg.map(([, v]) => v),
                  backgroundColor: ['#22558c', '#c47b28', '#2d7252', '#7c3aed', '#b83030', '#0891b2', '#64748b', '#94a3b8'],
                },
              ],
            }}
            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }}
          />
        </div>
        <div className="h-56 rounded-lg border border-[var(--border)] bg-[var(--paper)] p-2">
          <Doughnut
            data={{
              labels: ['Válido', 'Expira 30d', 'Expirado'],
              datasets: [
                {
                  data: [statusAgg.ok, statusAgg.soon, statusAgg.exp],
                  backgroundColor: ['#2d7252', '#f59e0b', '#b83030'],
                },
              ],
            }}
            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }}
          />
        </div>
        <div className="h-52 rounded-lg border border-[var(--border)] bg-[var(--paper)] p-2 lg:col-span-2">
          <Bar
            data={{
              labels: ownerBars.map(([o]) => o.slice(0, 18)),
              datasets: [{ label: 'Veículos', data: ownerBars.map(([, n]) => n), backgroundColor: '#22558c' }],
            }}
            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
          />
        </div>
        <div className="h-52 rounded-lg border border-[var(--border)] bg-[var(--paper)] p-2">
          <Bar
            data={{
              labels: makeBars.map(([m]) => String(m).slice(0, 12)),
              datasets: [{ label: 'Marca', data: makeBars.map(([, n]) => n), backgroundColor: '#c47b28' }],
            }}
            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
          />
        </div>
        <div className="h-52 rounded-lg border border-[var(--border)] bg-[var(--paper)] p-2">
          <Bar
            data={{
              labels: yearBars.map(([y]) => String(y)),
              datasets: [{ label: 'Ano', data: yearBars.map(([, n]) => n), backgroundColor: '#2d7252' }],
            }}
            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
          />
        </div>
      </div>

      <div className="mp-table-wrap max-h-[480px] overflow-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="sticky top-0 bg-[var(--paper)]">
            <tr>
              <th className="p-2 text-left">VIN</th>
              <th className="p-2 text-left">Insurance Date</th>
              <th className="p-2 text-left">Seguradora</th>
              <th className="p-2 text-left">Proprietário</th>
              <th className="p-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {(displayList.length ? displayList : cars.length ? [] : demoCars()).map((c) => {
              const st = statusOf(c.insuranceDate, now);
              const stLabel = st === 'expired' ? 'Expirado' : st === 'soon' ? 'Expira 30d' : 'Válido';
              const cls =
                st === 'expired' ? 'text-red-600' : st === 'soon' ? 'text-amber-600' : 'text-green-700';
              return (
                <tr key={c.vin} className="border-t border-[var(--border)]">
                  <td className="p-2 font-mono text-xs">{c.vin}</td>
                  <td className="p-2 font-mono text-xs">
                    {Number.isNaN(c.insuranceDate.getTime()) ? '—' : c.insuranceDate.toLocaleDateString()}
                  </td>
                  <td className="p-2 text-xs">{csvCell(c.row, 'Insurer', 'insurer', 'Insurance Company', 'Carrier')}</td>
                  <td className="p-2 text-xs">{csvCell(c.row, 'Owner', 'owner', 'Registered Owner')}</td>
                  <td className={`p-2 font-medium ${cls}`}>{stLabel}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--ink3)]">
        Linhas na tabela: {displayList.length || (!cars.length ? 40 : 0)} · clique nos banners para filtrar
      </p>
    </div>
  );
}

function demoCars(): Car[] {
  const now = new Date();
  return Array.from({ length: 67 }, (_, i) => ({
    vin: `DEMO${String(i).padStart(5, '0')}`,
    insuranceDate: new Date(now.getFullYear(), (i % 12) - 2, 10 + (i % 18)),
    row: {
      Insurer: i % 2 === 0 ? 'Infinity' : 'GEICO',
      Owner: OWNER_HIGHLIGHT[i % 3],
      Make: ['Toyota', 'Ford', 'Honda'][i % 3],
      Year: String(2018 + (i % 8)),
    },
  }));
}
