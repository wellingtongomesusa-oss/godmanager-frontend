'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import { csvCell, csvMoney } from '@/lib/manager-pro/csvCell';
import {
  appendTimelineEvent,
  financialBarPercents,
  loadInstallments,
  loadPayStatus,
  loadTimeline,
  mapCsvStatusToFlow,
  nextPayStatus,
  type PayFlowStatus,
  projectStorageId,
  saveInstallments,
  savePayStatus,
  seedInstallmentsIfEmpty,
  type InstallmentRow,
  type TimelineEvent,
} from '@/lib/manager-pro/renovationsStore';

export type RenovationProject = {
  id: string;
  index: number;
  property_address: string;
  owner: string;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  progress_percent: number;
  csvStatus: string;
  start_date: string;
  estimated_end_date: string;
};

function parseRenovationRows(rows: Record<string, string>[]): RenovationProject[] {
  return rows
    .filter((r) => csvCell(r, 'property_address', 'Property_Address', 'address').trim())
    .map((r, index) => ({
      id: '',
      index,
      property_address: csvCell(r, 'property_address', 'Property_Address', 'address'),
      owner: csvCell(r, 'owner', 'Owner'),
      total_amount: csvMoney(csvCell(r, 'total_amount', 'Total_Amount', 'total')),
      amount_paid: csvMoney(csvCell(r, 'amount_paid', 'Amount_Paid', 'paid')),
      amount_due: csvMoney(csvCell(r, 'amount_due', 'Amount_Due', 'due')),
      progress_percent: parseFloat(csvCell(r, 'progress_percent', 'Progress_Percent', 'progress')) || 0,
      csvStatus: csvCell(r, 'status', 'Status'),
      start_date: csvCell(r, 'start_date', 'Start_Date', 'start date'),
      estimated_end_date: csvCell(r, 'estimated_end_date', 'Estimated_End_Date', 'estimated end date'),
    }))
    .map((p, index) => ({
      ...p,
      id: projectStorageId(p.property_address, index),
    }));
}

function FinBar({ total, paid, due }: { total: number; paid: number; due: number }) {
  const { green, amber, gray } = financialBarPercents(total, paid, due);
  return (
    <div className="space-y-1">
      <div className="flex h-3 w-full max-w-md overflow-hidden rounded-full bg-gray-200">
        <div className="h-full bg-green-600 transition-all" style={{ width: `${green}%` }} title="Pago" />
        <div className="h-full bg-amber-500 transition-all" style={{ width: `${amber}%` }} title="Pendente" />
        <div className="h-full bg-gray-400 transition-all" style={{ width: `${gray}%` }} title="Futuro" />
      </div>
      <p className="text-[10px] text-[var(--ink3)]">
        <span className="text-green-700">■ Pago {green.toFixed(0)}%</span> ·{' '}
        <span className="text-amber-700">■ Pendente {amber.toFixed(0)}%</span> ·{' '}
        <span className="text-gray-600">■ Futuro {gray.toFixed(0)}%</span>
      </p>
    </div>
  );
}

const PILL: Record<PayFlowStatus, string> = {
  'Não Iniciado': 'bg-slate-200 text-slate-800',
  'Em Andamento': 'bg-blue-100 text-blue-900',
  'Em Aberto': 'bg-amber-100 text-amber-900',
  Pago: 'bg-green-100 text-green-900',
};

export default function RenovationsPage() {
  const [projects, setProjects] = useState<RenovationProject[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lsTick, setLsTick] = useState(0);
  const [timelineDraft, setTimelineDraft] = useState('');
  const [instForm, setInstForm] = useState({ description: '', value: '', due: '', status: 'Pendente' as InstallmentRow['status'] });

  const bump = useCallback(() => setLsTick((t) => t + 1), []);

  const rowsWithStatus = useMemo(() => {
    void lsTick;
    return projects.map((p) => ({
      ...p,
      status: (loadPayStatus(p.id) ?? mapCsvStatusToFlow(p.csvStatus)) as PayFlowStatus,
    }));
  }, [projects, lsTick]);

  const stats = useMemo(() => {
    let pago = 0;
    let andamento = 0;
    for (const p of rowsWithStatus) {
      if (p.status === 'Pago') pago++;
      else andamento++;
    }
    return { pago, andamento, total: projects.length };
  }, [rowsWithStatus, projects.length]);

  const ingestCsvText = useCallback((text: string) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const data = (res.data as Record<string, string>[]) || [];
        setProjects(parseRenovationRows(data));
        setExpandedId(null);
      },
    });
  }, []);

  const onFile = (f: File) => {
    f.text().then((text) => ingestCsvText(text));
  };

  const loadDemo = () => {
    fetch('/renovations_import_demo.csv')
      .then((r) => r.text())
      .then((t) => ingestCsvText(t));
  };

  useEffect(() => {
    fetch('/renovations_import_demo.csv')
      .then((r) => r.text())
      .then((t) => ingestCsvText(t));
  }, [ingestCsvText]);

  const cycleStatus = (p: RenovationProject) => {
    const cur = loadPayStatus(p.id) ?? mapCsvStatusToFlow(p.csvStatus);
    const nxt = nextPayStatus(cur);
    savePayStatus(p.id, nxt);
    appendTimelineEvent(p.id, `Pagamento: ${cur} → ${nxt}`);
    bump();
  };

  const selected = expandedId ? projects.find((p) => p.id === expandedId) : null;
  const installments = selected ? loadInstallments(selected.id) : [];
  const timeline = selected ? loadTimeline(selected.id) : [];

  const ensureInstallments = () => {
    if (!selected) return;
    seedInstallmentsIfEmpty(
      selected.id,
      selected.total_amount,
      selected.amount_paid,
      selected.start_date,
      selected.estimated_end_date
    );
    bump();
  };

  const addInstallment = () => {
    if (!selected) return;
    const v = parseFloat(instForm.value.replace(/,/g, '')) || 0;
    const row: InstallmentRow = {
      id: `inst_${Date.now()}`,
      description: instForm.description || 'Parcela',
      value: v,
      due_date: instForm.due,
      paid_at: instForm.status === 'Pago' ? new Date().toISOString().slice(0, 10) : '',
      status: instForm.status,
    };
    saveInstallments(selected.id, [...loadInstallments(selected.id), row]);
    appendTimelineEvent(selected.id, `Parcela adicionada: ${row.description} ($${v})`);
    setInstForm({ description: '', value: '', due: '', status: 'Pendente' });
    bump();
  };

  const updateInstallment = (id: string, patch: Partial<InstallmentRow>) => {
    if (!selected) return;
    const next = loadInstallments(selected.id).map((r) => (r.id === id ? { ...r, ...patch } : r));
    saveInstallments(selected.id, next);
    bump();
  };

  const addTimeline = () => {
    if (!selected || !timelineDraft.trim()) return;
    appendTimelineEvent(selected.id, timelineDraft.trim());
    setTimelineDraft('');
    bump();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--ink)]">Renovations</h1>
        <p className="text-sm text-[var(--ink2)]">
          <code className="rounded bg-[var(--cream)] px-1 text-xs">renovations_import.csv</code> · 23 projetos (ref.) ·
          colunas: property_address, owner, total_amount, amount_paid, amount_due, progress_percent, status, start_date,
          estimated_end_date
        </p>
        <p className="mt-1 text-xs text-[var(--ink3)]">
          Fluxo pagamento: <strong>Não Iniciado → Em Andamento → Em Aberto → Pago</strong> · clique no pill (sem confirmação)
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="text-xs font-medium">
          Importar CSV
          <input type="file" accept=".csv" className="mt-1 block" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
        <button type="button" className="self-end rounded border border-[var(--border)] px-3 py-2 text-xs" onClick={loadDemo}>
          Recarregar demo (23)
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="mp-card p-4" style={{ ['--bar-color' as string]: 'var(--green)' }}>
          <p className="mp-label">Concluídos (Pago)</p>
          <p className="mp-value mt-1">{stats.pago}</p>
        </div>
        <div className="mp-card p-4" style={{ ['--bar-color' as string]: 'var(--amber)' }}>
          <p className="mp-label">Em andamento / outros</p>
          <p className="mp-value mt-1">{stats.andamento}</p>
        </div>
        <div className="mp-card p-4" style={{ ['--bar-color' as string]: 'var(--ink)' }}>
          <p className="mp-label">Total projetos</p>
          <p className="mp-value mt-1">{stats.total}</p>
        </div>
      </div>
      <p className="text-xs text-[var(--ink3)]">Ref. dados demo: 18 concluídos + 5 em andamento</p>

      <div className="mp-table-wrap">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr>
              <th className="p-2 w-8" />
              <th className="p-2 text-left">Endereço</th>
              <th className="p-2 text-left">Owner</th>
              <th className="p-2 text-right">Total</th>
              <th className="p-2 text-right">Pago</th>
              <th className="p-2 text-right">Em aberto</th>
              <th className="p-2 text-right">%</th>
              <th className="p-2 text-left">Status fluxo</th>
              <th className="p-2 text-left">Início → Fim</th>
            </tr>
          </thead>
          <tbody>
            {rowsWithStatus.map((p) => (
              <tr key={p.id} className="border-t border-[var(--border)] hover:bg-[var(--cream)]/50">
                <td className="p-2">
                  <button
                    type="button"
                    className="text-[var(--ink2)]"
                    onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                    aria-expanded={expandedId === p.id}
                  >
                    {expandedId === p.id ? '▼' : '▶'}
                  </button>
                </td>
                <td className="p-2 max-w-[220px]">
                  <span className="line-clamp-2" title={p.property_address}>
                    {p.property_address}
                  </span>
                </td>
                <td className="p-2 text-xs text-[var(--ink2)]">{p.owner || '—'}</td>
                <td className="p-2 text-right font-mono">${p.total_amount.toLocaleString()}</td>
                <td className="p-2 text-right font-mono text-green-700">${p.amount_paid.toLocaleString()}</td>
                <td className="p-2 text-right font-mono text-amber-800">${p.amount_due.toLocaleString()}</td>
                <td className="p-2 text-right font-mono">{p.progress_percent}%</td>
                <td className="p-2">
                  <button
                    type="button"
                    title="Clique para avançar no fluxo (sem confirmação)"
                    onClick={() => cycleStatus(p)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${PILL[p.status]}`}
                  >
                    {p.status}
                  </button>
                </td>
                <td className="p-2 whitespace-nowrap text-xs text-[var(--ink3)]">
                  {p.start_date || '—'} → {p.estimated_end_date || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="space-y-6 rounded-xl border border-[var(--border)] bg-[var(--paper)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-[var(--ink3)]">Projeto selecionado</p>
              <p className="font-medium text-[var(--ink)]">{selected.property_address}</p>
            </div>
            <FinBar total={selected.total_amount} paid={selected.amount_paid} due={selected.amount_due} />
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--ink)]">Parcelas</p>
              <button type="button" className="text-xs text-[var(--blue)] underline" onClick={ensureInstallments}>
                Gerar 4 parcelas modelo (se vazio)
              </button>
            </div>
            <div className="mp-table-wrap">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="p-2 text-left">Descrição</th>
                    <th className="p-2 text-right">Valor</th>
                    <th className="p-2 text-left">Vencimento</th>
                    <th className="p-2 text-left">Pago em</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {installments.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-3 text-[var(--ink3)]">
                        Sem parcelas — use o botão acima ou adicione manualmente.
                      </td>
                    </tr>
                  )}
                  {installments.map((row) => (
                    <tr key={row.id} className="border-t border-[var(--border)]">
                      <td className="p-2">{row.description}</td>
                      <td className="p-2 text-right font-mono">${row.value.toLocaleString()}</td>
                      <td className="p-2 font-mono">{row.due_date}</td>
                      <td className="p-2">
                        <input
                          className="w-full max-w-[120px] rounded border px-1 font-mono"
                          type="date"
                          value={row.paid_at?.slice(0, 10) ?? ''}
                          onChange={(e) =>
                            updateInstallment(row.id, {
                              paid_at: e.target.value,
                              status: e.target.value ? 'Pago' : row.status === 'Pago' ? 'Pendente' : row.status,
                            })
                          }
                        />
                      </td>
                      <td className="p-2">
                        <select
                          className="rounded border px-1"
                          value={row.status}
                          onChange={(e) =>
                            updateInstallment(row.id, {
                              status: e.target.value as InstallmentRow['status'],
                            })
                          }
                        >
                          <option value="Pendente">Pendente</option>
                          <option value="Pago">Pago</option>
                          <option value="Atrasado">Atrasado</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-[var(--border)]/50 pt-3">
              <input
                placeholder="Descrição"
                className="rounded border px-2 py-1 text-xs"
                value={instForm.description}
                onChange={(e) => setInstForm((f) => ({ ...f, description: e.target.value }))}
              />
              <input
                placeholder="Valor"
                className="w-24 rounded border px-2 py-1 text-xs font-mono"
                value={instForm.value}
                onChange={(e) => setInstForm((f) => ({ ...f, value: e.target.value }))}
              />
              <input
                type="date"
                className="rounded border px-2 py-1 text-xs"
                value={instForm.due}
                onChange={(e) => setInstForm((f) => ({ ...f, due: e.target.value }))}
              />
              <select
                className="rounded border px-2 py-1 text-xs"
                value={instForm.status}
                onChange={(e) => setInstForm((f) => ({ ...f, status: e.target.value as InstallmentRow['status'] }))}
              >
                <option value="Pendente">Pendente</option>
                <option value="Pago">Pago</option>
                <option value="Atrasado">Atrasado</option>
              </select>
              <button type="button" className="rounded bg-[var(--ink)] px-3 py-1 text-xs text-white" onClick={addInstallment}>
                Adicionar parcela
              </button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-[var(--ink)]">Histórico (localStorage)</p>
            <div className="flex flex-wrap gap-2">
              <input
                className="min-w-[200px] flex-1 rounded border px-2 py-1 text-sm"
                placeholder="Novo evento…"
                value={timelineDraft}
                onChange={(e) => setTimelineDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTimeline()}
              />
              <button type="button" className="rounded border border-[var(--border)] px-3 py-1 text-sm" onClick={addTimeline}>
                Registar
              </button>
            </div>
            <ul className="mt-3 max-h-48 space-y-2 overflow-auto border-t border-[var(--border)]/40 pt-3">
              {timeline.length === 0 && <li className="text-xs text-[var(--ink3)]">Sem eventos ainda.</li>}
              {timeline.map((ev: TimelineEvent) => (
                <li key={ev.id} className="border-l-2 border-[var(--amber)] pl-3 text-sm">
                  <span className="font-mono text-xs text-[var(--ink3)]">
                    {new Date(ev.at).toLocaleString()}
                  </span>
                  <p className="text-[var(--ink)]">{ev.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
