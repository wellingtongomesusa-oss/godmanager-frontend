'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  PORTFOLIO_ONE_REF,
  aggregatePortfolioKpis,
  filterPortfolioRows,
  getOutHomeDetailRows,
  parsePortfolioCsvRow,
  type PortfolioCsvRow,
} from '@/lib/manager-pro/propertiesPortfolioCsv';

type Props = {
  csvRows: Record<string, string>[];
  onClearCsv?: () => void;
};

function fmtMoney(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
}

function fmtNum(n: number, digits = 0) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(n);
}

export function PropertiesPortfolioOnePanel({ csvRows, onClearCsv }: Props) {
  const parsed = useMemo(() => {
    const out: PortfolioCsvRow[] = [];
    for (const r of csvRows) {
      const row = parsePortfolioCsvRow(r);
      if (row) out.push(row);
    }
    return out;
  }, [csvRows]);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [bedFilter, setBedFilter] = useState<number | 'all'>('all');
  const [periodMonth, setPeriodMonth] = useState('');
  const [outGroupHidden, setOutGroupHidden] = useState(false);
  const [outDetailsOpen, setOutDetailsOpen] = useState(false);
  const [hiddenDetailKeys, setHiddenDetailKeys] = useState<Set<string>>(() => new Set());

  const statusOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of parsed) {
      if (r.status) s.add(r.status);
    }
    return ['all', ...[...s].sort((a, b) => a.localeCompare(b))];
  }, [parsed]);

  const monthOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of parsed) {
      if (r.dateParsed) {
        s.add(`${r.dateParsed.getFullYear()}-${String(r.dateParsed.getMonth() + 1).padStart(2, '0')}`);
      }
    }
    return [...s].sort().reverse();
  }, [parsed]);

  const bedOptions = useMemo(() => {
    const s = new Set<number>();
    for (const r of parsed) s.add(r.bedrooms);
    return ['all', ...[...s].sort((a, b) => a - b)] as const;
  }, [parsed]);

  const filtered = useMemo(
    () => filterPortfolioRows(parsed, { status: statusFilter, bedrooms: bedFilter, periodMonth }),
    [parsed, statusFilter, bedFilter, periodMonth]
  );

  const kpi = useMemo(() => aggregatePortfolioKpis(filtered), [filtered]);

  const hasData = parsed.length > 0;

  const display = useMemo(() => {
    if (hasData) {
      return {
        totalAdmFee: kpi.totalAdmFee,
        totalCommissions: kpi.totalCommissions,
        totalHouses: kpi.totalHouses,
        housesCommChange: kpi.housesCommChange,
        totalManagedAmount: kpi.totalManagedAmount,
        avgSqft: kpi.avgSqft,
        totalBedrooms: kpi.totalBedrooms,
        outQty: outGroupHidden ? 0 : kpi.outHomesQty,
        outVal: outGroupHidden ? 0 : kpi.outHomesValue,
      };
    }
    return {
      totalAdmFee: 0,
      totalCommissions: 0,
      totalHouses: PORTFOLIO_ONE_REF.totalHouses,
      housesCommChange: 0,
      totalManagedAmount: 0,
      avgSqft: 0,
      totalBedrooms: PORTFOLIO_ONE_REF.totalBedrooms,
      outQty: PORTFOLIO_ONE_REF.outHomesQty,
      outVal: PORTFOLIO_ONE_REF.outHomesValue,
    };
  }, [hasData, kpi, outGroupHidden]);

  const outDetailRows = useMemo(() => {
    const base = getOutHomeDetailRows(filtered);
    return base.filter((r) => !hiddenDetailKeys.has(rowStableKey(r)));
  }, [filtered, hiddenDetailKeys]);

  const hideDetailRow = useCallback((row: PortfolioCsvRow) => {
    const k = rowStableKey(row);
    setHiddenDetailKeys((prev) => new Set(prev).add(k));
  }, []);

  return (
    <section className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--paper)] p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink3)]">GodManager.One</p>
          <h2 className="text-lg font-bold text-[var(--ink)]">Portfólio · Properties CSV</h2>
          <p className="mt-0.5 text-xs text-[var(--ink2)]">
            KPIs e OUT HOMES a partir do CSV de todas as unidades. Colunas reconhecidas: Property, ADM Fee, Commission, Managed
            Amount, SQFT, Bedrooms, Commission Change, Status, Group (ex. OUT HOMES), Date, Amount.
          </p>
        </div>
        {!hasData && (
          <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-900">
            Referência GodManager.One · carregue CSV para valores reais
          </span>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--cream)] p-3">
        <span className="text-xs font-semibold text-[var(--ink)]">Filtros</span>
        <label className="flex items-center gap-1.5 text-xs">
          <span className="text-[var(--ink3)]">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border border-[var(--border)] bg-[var(--paper)] px-2 py-1 text-xs text-[var(--ink)]"
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s === 'all' ? 'Todos' : s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <span className="text-[var(--ink3)]">Bedrooms</span>
          <select
            value={bedFilter === 'all' ? 'all' : String(bedFilter)}
            onChange={(e) => setBedFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))}
            className="rounded border border-[var(--border)] bg-[var(--paper)] px-2 py-1 text-xs text-[var(--ink)]"
          >
            {bedOptions.map((b) => (
              <option key={String(b)} value={String(b)}>
                {b === 'all' ? 'Todos' : `${b} BR`}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <span className="text-[var(--ink3)]">Período</span>
          <select
            value={periodMonth}
            onChange={(e) => setPeriodMonth(e.target.value)}
            className="rounded border border-[var(--border)] bg-[var(--paper)] px-2 py-1 text-xs text-[var(--ink)]"
          >
            <option value="">Todos</option>
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        {onClearCsv && csvRows.length > 0 && (
          <button
            type="button"
            onClick={onClearCsv}
            className="ml-auto rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--ink2)] hover:bg-[var(--sand)]"
          >
            Limpar CSV portfólio
          </button>
        )}
      </div>

      {/* 8 KPI cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total ADM Fee" value={fmtMoney(display.totalAdmFee)} />
        <KpiCard label="Total Commissions" value={fmtMoney(display.totalCommissions)} />
        <KpiCard label="Total Houses" value={fmtNum(display.totalHouses)} sub={hasData ? `${filtered.length} no filtro` : 'ref. 975'} />
        <KpiCard label="Houses w/ Comm. Changes" value={fmtNum(display.housesCommChange)} />
        <KpiCard label="Total Managed Amount" value={fmtMoney(display.totalManagedAmount)} />
        <KpiCard label="Avg SQFT" value={display.avgSqft > 0 ? fmtNum(display.avgSqft, 1) : '—'} sub="m² / sqft" />
        <KpiCard label="Total Bedrooms" value={fmtNum(display.totalBedrooms)} sub={hasData ? undefined : 'ref. 5.558'} />
        <div className="mp-card flex flex-col justify-between p-3 [--bar-color:var(--slate)]">
          <p className="mp-label">OUT HOMES</p>
          <p className="mp-value mt-1 text-base sm:text-lg">
            Qty {display.outQty} · {fmtMoney(display.outVal)}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setOutDetailsOpen((v) => !v)}
              className="rounded border border-[var(--border)] bg-[var(--paper)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink)] hover:bg-[var(--cream)]"
            >
              DET
            </button>
            <button
              type="button"
              onClick={() => {
                setOutGroupHidden((h) => !h);
                if (!outGroupHidden) setOutDetailsOpen(false);
              }}
              className="rounded border border-[var(--border)] bg-[var(--paper)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink2)] hover:bg-[var(--cream)]"
            >
              {outGroupHidden ? 'SHOW' : 'HIDE'}
            </button>
          </div>
          <p className="mp-card-sub1 mt-1 text-[10px]">Por grupo · oculta KPI e detalhe</p>
        </div>
      </div>

      {/* Placeholder W — wide */}
      <div
        className="flex min-h-[72px] items-center justify-center rounded-lg border-2 border-dashed border-[var(--border)] bg-[var(--slate-bg)]/50 text-xs font-medium text-[var(--ink3)]"
        title="Espaço reservado · widget wide"
      >
        Card <span className="mx-1 rounded bg-[var(--ink)]/10 px-1.5 py-0.5 font-mono text-[10px] text-[var(--ink)]">W</span>{' '}
        (wide) — novo widget futuro
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {/* Placeholder E */}
        <div
          className="flex min-h-[100px] items-center justify-center rounded-lg border-2 border-dashed border-[var(--border)] bg-[var(--cream)]/80 text-xs font-medium text-[var(--ink3)] lg:col-span-1"
          title="Espaço reservado · edição"
        >
          Card <span className="mx-1 rounded bg-[var(--amber)]/20 px-1.5 py-0.5 font-mono text-[10px] text-[var(--amber)]">E</span>{' '}
          (edit) — novo widget futuro
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--cream)]/40 p-3 text-[11px] text-[var(--ink2)] lg:col-span-2">
          <p className="font-semibold text-[var(--ink)]">Grupo OUT HOMES no CSV</p>
          <p className="mt-1">
            Preencha a coluna <strong>Group</strong> / <strong>Portfolio Group</strong> com <code className="rounded bg-[var(--paper)] px-1">OUT HOMES</code> para
            contagem e tabela de detalhe. <strong>Amount</strong> alimenta o valor do grupo.
          </p>
        </div>
      </div>

      {/* OUT HOMES DETAILS */}
      {outDetailsOpen && !outGroupHidden && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-[var(--ink)]">OUT HOMES DETAILS</h3>
          <div className="mp-table-wrap max-h-[360px] overflow-auto rounded-lg border border-[var(--border)]">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 bg-[var(--paper)]">
                <tr>
                  <th className="p-2 text-left text-xs font-semibold text-[var(--ink2)]">Property</th>
                  <th className="p-2 text-right text-xs font-semibold text-[var(--ink2)]">Amount</th>
                  <th className="p-2 text-left text-xs font-semibold text-[var(--ink2)]">Date</th>
                  <th className="p-2 text-left text-xs font-semibold text-[var(--ink2)]">Status</th>
                  <th className="p-2 text-right text-xs font-semibold text-[var(--ink2)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {outDetailRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-xs text-[var(--ink3)]">
                      Nenhuma linha OUT HOMES no filtro atual. Ajuste filtros ou CSV.
                    </td>
                  </tr>
                )}
                {outDetailRows.map((row) => (
                  <tr key={rowStableKey(row)} className="border-t border-[var(--border)]">
                    <td className="p-2 font-medium text-[var(--ink)]">{row.property}</td>
                    <td className="p-2 text-right font-mono text-xs">{fmtMoney(row.amount)}</td>
                    <td className="p-2 font-mono text-xs text-[var(--ink2)]">{row.dateRaw || '—'}</td>
                    <td className="p-2">
                      <span className="inline-flex rounded-full bg-[#374151] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        {row.status || 'Active'}
                      </span>
                    </td>
                    <td className="p-2 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <MiniAct label="EDIT" title="Edição (futuro)" />
                        <MiniAct label="FIN" title="Finalizar (futuro)" />
                        <button
                          type="button"
                          title="Ocultar linha nesta sessão"
                          onClick={() => hideDetailRow(row)}
                          className="rounded border border-[var(--border)] bg-[var(--paper)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ink2)] hover:bg-[var(--cream)]"
                        >
                          HIDE
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function rowStableKey(row: PortfolioCsvRow) {
  return `${row.property}|${row.dateRaw}|${row.group}|${row.amount}`;
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="mp-card p-3 [--bar-color:var(--amber)]">
      <p className="mp-label leading-tight">{label}</p>
      <p className="mp-value mt-1 break-all text-lg">{value}</p>
      {sub && <p className="mp-card-sub1 mt-0.5">{sub}</p>}
    </div>
  );
}

function MiniAct({ label, title }: { label: string; title: string }) {
  return (
    <button
      type="button"
      title={title}
      className="rounded border border-[var(--border)] bg-[var(--paper)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ink)] hover:bg-[var(--cream)]"
    >
      {label}
    </button>
  );
}
