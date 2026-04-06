'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import {
  aggregate1099BySegment,
  aggregateHospitalityByStorageMonth,
  COA_1099_ELIGIBLE,
  COA_HOSPITALITY,
  DEMO_HOSPITALITY,
  DEMO_SEGMENTS,
  filter1099Eligible,
  IRS_1099_THRESHOLD,
  qualified1099Vendors,
  storageKey,
  STORAGE_PREFIX,
  toQualifiedCsv,
  type SegmentKey,
  type StoredMonthPayload,
} from '@/lib/manager-pro/irs1099Merge';

function listStorageKeys(): string[] {
  if (typeof window === 'undefined') return [];
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(STORAGE_PREFIX)) keys.push(k);
  }
  return keys.sort();
}

function loadPayload(key: string): StoredMonthPayload | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (Array.isArray(p)) return { rows: p as Record<string, string>[], uploadedAt: '' };
    if (p && typeof p === 'object' && Array.isArray((p as StoredMonthPayload).rows)) {
      return p as StoredMonthPayload;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function loadRows(key: string): Record<string, string>[] {
  return loadPayload(key)?.rows ?? [];
}

const SEG_ORDER: SegmentKey[] = ['CONTRACTORS', 'CLEANERS', 'RENT', 'VENDORS+OUTROS'];

const SEG_LABEL: Record<SegmentKey, string> = {
  CONTRACTORS: 'CONTRACTORS',
  CLEANERS: 'CLEANERS',
  RENT: 'RENT',
  'VENDORS+OUTROS': 'VENDORS+OUTROS',
};

export default function Irs1099Page() {
  const [tab, setTab] = useState<'1099' | 'hospitality'>('1099');
  const [tick, setTick] = useState(0);
  const [msg, setMsg] = useState('');
  const [uploadYear, setUploadYear] = useState(() => new Date().getFullYear());
  const [uploadMonth, setUploadMonth] = useState(() => new Date().getMonth() + 1);

  const bump = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    bump();
  }, [bump]);

  const storageKeys = useMemo(() => {
    void tick;
    return listStorageKeys();
  }, [tick]);

  const allRows = useMemo(() => {
    void tick;
    const out: Record<string, string>[] = [];
    for (const k of listStorageKeys()) {
      out.push(...loadRows(k));
    }
    return out;
  }, [tick]);

  const rows1099 = useMemo(() => filter1099Eligible(allRows), [allRows]);
  const segmentMap = useMemo(() => aggregate1099BySegment(rows1099), [rows1099]);
  const qualified = useMemo(() => qualified1099Vendors(rows1099), [rows1099]);

  const hospitalityByMonth = useMemo(() => {
    void tick;
    return aggregateHospitalityByStorageMonth(loadRows);
  }, [tick]);

  const hospitalityTotalStored = useMemo(
    () => hospitalityByMonth.reduce((s, x) => s + x.total, 0),
    [hospitalityByMonth]
  );

  const has1099Lines = rows1099.length > 0;

  const onBills = (f: File) => {
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rows = (res.data as Record<string, string>[]) || [];
        const key = storageKey(uploadYear, uploadMonth);
        const payload: StoredMonthPayload = {
          rows,
          uploadedAt: new Date().toISOString(),
          fileName: f.name,
        };
        localStorage.setItem(key, JSON.stringify(payload));
        setMsg(
          `✓ ${rows.length} linhas gravadas em ${key} — substitui o mês (sem duplicar).`
        );
        bump();
      },
    });
  };

  const clearMonth = (key: string) => {
    localStorage.removeItem(key);
    bump();
    setMsg(`Removido ${key}`);
  };

  const exportQualifiedCsv = () => {
    const csv = toQualifiedCsv(qualified);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `1099_qualified_vendors_${IRS_1099_THRESHOLD}plus_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const printQualifiedPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="text-xl font-bold text-[var(--ink)]">1099 / IRS</h1>
        <p className="text-sm text-[var(--ink2)]">
          <strong>AllBillsPage CSV</strong> (upload mensal) · filtro 1099: Chart of Account ={' '}
          <code className="rounded bg-[var(--cream)] px-1 text-xs">{COA_1099_ELIGIBLE}</code>
        </p>
        <p className="mt-1 text-xs text-[var(--ink3)]">
          Hospitality:{' '}
          <code className="rounded bg-[var(--cream)] px-1">{COA_HOSPITALITY}</code> · acumulação por chave{' '}
          <code className="rounded bg-[var(--cream)] px-1">1099_data_YYYY_MM</code> — re-upload do mesmo mês{' '}
          <strong>substitui</strong> (sem duplicar).
        </p>
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        <button
          type="button"
          onClick={() => setTab('1099')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            tab === '1099' ? 'bg-[var(--amber)] text-white' : 'bg-[var(--cream)] text-[var(--ink2)]'
          }`}
        >
          1099
        </button>
        <button
          type="button"
          onClick={() => setTab('hospitality')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            tab === 'hospitality' ? 'bg-[var(--amber)] text-white' : 'bg-[var(--cream)] text-[var(--ink2)]'
          }`}
        >
          Hospitality (repasses owners)
        </button>
      </div>

      <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--cream)] p-4 print:hidden">
        <p className="text-xs font-semibold text-[var(--ink)]">Upload mensal</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs">
            Ano
            <select
              className="ml-1 rounded border px-2 py-1"
              value={uploadYear}
              onChange={(e) => setUploadYear(Number(e.target.value))}
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            Mês
            <select
              className="ml-1 rounded border px-2 py-1"
              value={uploadMonth}
              onChange={(e) => setUploadMonth(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {String(m).padStart(2, '0')}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium">
            AllBillsPage.csv
            <input type="file" accept=".csv" className="mt-1 block" onChange={(e) => e.target.files?.[0] && onBills(e.target.files[0])} />
          </label>
        </div>
        {msg && <p className="text-sm text-[var(--green)]">{msg}</p>}
        <div className="text-xs text-[var(--ink3)]">
          <p className="font-medium text-[var(--ink2)]">Meses gravados ({storageKeys.length})</p>
          <ul className="mt-1 max-h-28 overflow-auto font-mono">
            {storageKeys.map((k) => {
              const p = loadPayload(k);
              return (
                <li key={k} className="flex flex-wrap items-center gap-2 border-t border-[var(--border)]/50 py-1">
                  <span>{k}</span>
                  <span>
                    {p?.rows?.length ?? 0} linhas
                    {p?.uploadedAt && ` · ${new Date(p.uploadedAt).toLocaleString()}`}
                  </span>
                  <button type="button" className="text-[var(--red)] underline" onClick={() => clearMonth(k)}>
                    remover
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {tab === '1099' && (
        <div className="space-y-6 print:hidden">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-sm font-medium"
              onClick={exportQualifiedCsv}
              disabled={!qualified.length}
            >
              Export CSV (≥ ${IRS_1099_THRESHOLD})
            </button>
            <button
              type="button"
              className="rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-sm font-medium"
              onClick={printQualifiedPdf}
              disabled={!qualified.length}
            >
              Export PDF (impressão)
            </button>
            <span className="self-center text-xs text-[var(--ink3)]">
              {qualified.length} vendor(s) qualificados (IRS ≥ ${IRS_1099_THRESHOLD}) · {rows1099.length} linhas 1099
              eligible
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {SEG_ORDER.map((seg) => {
              const agg = segmentMap.get(seg)!;
              const demo = DEMO_SEGMENTS[seg];
              const total = has1099Lines ? agg.total : demo.total;
              const vendors = has1099Lines ? agg.vendorCount : demo.vendors;
              const classLine = has1099Lines
                ? `${agg.classCount} classes`
                : seg === 'CONTRACTORS'
                  ? demo.classes
                  : seg === 'CLEANERS'
                    ? 'CLEANER'
                    : seg === 'RENT'
                      ? 'RENT'
                      : '—';
              return (
                <div key={seg} className="mp-card p-4" style={{ ['--bar-color' as string]: 'var(--slate)' }}>
                  <p className="mp-label">{SEG_LABEL[seg]}</p>
                  <p className="mp-value mt-2 font-mono">${total.toLocaleString()}</p>
                  <p className="mt-1 text-xs text-[var(--ink3)]">
                    {vendors} vendors · {classLine}
                  </p>
                </div>
              );
            })}
          </div>

          {!has1099Lines && (
            <p className="text-center text-xs text-[var(--ink3)]">
              Segmentos acima = referência PDF. Carregue CSVs por mês para totais reais.
            </p>
          )}
        </div>
      )}

      {tab === 'hospitality' && (
        <div className="space-y-4 print:hidden">
          {hospitalityByMonth.length === 0 ? (
            <>
              <p className="mp-value font-mono">${DEMO_HOSPITALITY.totalRef.toLocaleString()}</p>
              <p className="text-sm text-[var(--ink2)]">Total ref. Jan + Fev + Mar/2026 (sem dados gravados)</p>
              <ul className="space-y-1 text-sm">
                {DEMO_HOSPITALITY.months.map((m) => (
                  <li key={m.label} className="flex justify-between gap-4 border-b border-[var(--border)]/40 py-2">
                    <span>{m.label}</span>
                    <span className="font-mono">${m.total.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p className="mp-value font-mono">${hospitalityTotalStored.toLocaleString()}</p>
              <p className="text-sm text-[var(--ink2)]">
                Soma de todos os meses gravados (COA Hospitality) · {hospitalityByMonth.length} mês(es)
              </p>
              <ul className="space-y-1 text-sm">
                {hospitalityByMonth.map((h) => (
                  <li key={h.key} className="flex justify-between gap-4 border-b border-[var(--border)]/40 py-2">
                    <span>
                      {h.year}-{String(h.month).padStart(2, '0')} ({h.key})
                    </span>
                    <span className="font-mono">${h.total.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* Impressão / “PDF” — apenas vendors qualificados */}
      <div className="hidden print:block print:p-6">
        <h1 className="text-lg font-bold">1099 — Vendors qualificados (≥ ${IRS_1099_THRESHOLD})</h1>
        <p className="text-sm text-gray-600">Chart of Account: {COA_1099_ELIGIBLE}</p>
        <p className="text-xs text-gray-500">Gerado {new Date().toLocaleString()}</p>
        <table className="mt-4 w-full text-sm border-collapse border border-gray-400">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 p-2 text-left">Vendor</th>
              <th className="border border-gray-400 p-2 text-right">Total USD</th>
              <th className="border border-gray-400 p-2 text-left">Segmento</th>
            </tr>
          </thead>
          <tbody>
            {qualified.map((q) => (
              <tr key={q.vendor}>
                <td className="border border-gray-400 p-2">{q.vendor}</td>
                <td className="border border-gray-400 p-2 text-right font-mono">${q.total.toLocaleString()}</td>
                <td className="border border-gray-400 p-2">{q.segment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
