'use client';

import { useCallback, useEffect, useState } from 'react';

type Cell = { received: number; paid: number; expected: number };
type MatrixRow = { propertyId: string; owner: string; rent: number; months: string[]; cells: Record<string, Cell> };
type LeaseLite = { id: string; leaseNumber: number; status: string; monthlyRent: string; securityDeposit: string; tenantName: string };
type Job = {
  id: string;
  propertyId: string;
  vendorName?: string;
  serviceType?: string;
  status?: string;
  description?: string;
  serviceDate?: string;
  createdAt?: string;
  ownerCharged?: string | number;
};

function money(n: unknown) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function HouseDetailModal({
  propertyId,
  address,
  code,
  tenantName,
  clientId,
  onClose,
  onOpenLeasesTab,
}: {
  propertyId: string;
  address: string;
  code: string;
  tenantName: string;
  clientId: string;
  onClose: () => void;
  onOpenLeasesTab?: () => void;
}) {
  const qs = clientId ? `?clientId=${encodeURIComponent(clientId)}` : '';
  const [tab, setTab] = useState<'receipts' | 'payout' | 'contract' | 'docs' | 'jobs'>('receipts');
  const [row, setRow] = useState<MatrixRow | null>(null);
  const [lease, setLease] = useState<LeaseLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [jobsLoading, setJobsLoading] = useState(false);

  const loadJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const r = await fetch(`/api/pm/expenses${qs}`, { credentials: 'include', cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      const list: Job[] = (j?.expenses || []).filter((e: { propertyId: string }) => e.propertyId === propertyId);
      setJobs(list);
    } catch {
      setJobs([]);
    } finally {
      setJobsLoading(false);
    }
  }, [propertyId, qs]);

  useEffect(() => {
    if (tab === 'jobs' && jobs === null) void loadJobs();
  }, [tab, jobs, loadJobs]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const yr = new Date().getUTCFullYear();
      const [mx, ls] = await Promise.all([
        fetch(`/api/results/gl-matrix${qs ? qs + '&' : '?'}year=${yr}`, { credentials: 'include', cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
        fetch(`/api/lease-agreements${qs}`, { credentials: 'include', cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
      ]);
      if (mx?.ok) {
        const r = (mx.rows || []).find((x: MatrixRow) => x.propertyId === propertyId);
        if (r) setRow({ ...r, months: mx.months || [] });
        else setRow({ propertyId, owner: '', rent: 0, months: mx.months || [], cells: {} });
      }
      if (ls?.ok) {
        const l = (ls.leases || []).find((x: { propertyId: string }) => x.propertyId === propertyId);
        if (l) setLease(l);
      }
    } finally {
      setLoading(false);
    }
  }, [propertyId, qs]);

  useEffect(() => {
    void load();
  }, [load]);

  const monthsWith = row ? row.months.filter((m) => row.cells[m]) : [];
  const tabBtn = (k: typeof tab, label: string) => (
    <button key={k} onClick={() => setTab(k)} className={`rounded-t-lg px-3 py-2 text-xs font-semibold ${tab === k ? 'bg-[#22558c] text-white' : 'text-slate-500 hover:text-slate-700'}`}>
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{address}</h2>
            <p className="text-xs text-slate-500">
              {code} · Inquilino: {tenantName || '—'} {row?.owner ? `· Owner: ${row.owner}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-2xl text-slate-400 hover:text-slate-600">×</button>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-slate-200 px-6 pt-3">
          {tabBtn('receipts', 'Recebimentos')}
          {tabBtn('payout', 'Repasse')}
          {tabBtn('contract', 'Contrato')}
          {tabBtn('docs', 'Documentos')}
          {tabBtn('jobs', 'Chamados')}
        </div>

        <div className="flex-1 overflow-auto px-6 py-4">
          {loading ? (
            <div className="py-10 text-center text-slate-400">Carregando…</div>
          ) : (tab === 'receipts' || tab === 'payout') ? (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <th className="px-3 py-2">Mês</th>
                    {tab === 'receipts' ? (
                      <th className="px-3 py-2 text-right">Recebido (GL 4100)</th>
                    ) : (
                      <>
                        <th className="px-3 py-2 text-right">Repasse esperado</th>
                        <th className="px-3 py-2 text-right">Pago ao owner</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {monthsWith.map((m) => {
                    const c = row!.cells[m];
                    return (
                      <tr key={m} className="border-b border-slate-100">
                        <td className="px-3 py-2 font-mono">{m}</td>
                        {tab === 'receipts' ? (
                          <td className="px-3 py-2 text-right font-mono text-green-700">{money(c.received)}</td>
                        ) : (
                          <>
                            <td className="px-3 py-2 text-right font-mono">{money(c.expected)}</td>
                            <td className="px-3 py-2 text-right font-mono text-red-700">{money(c.paid)}</td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                  {monthsWith.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-8 text-center text-slate-400">Sem lançamentos no GL deste ano.</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-slate-400">Fonte: General Ledger (AppFolio).</p>
            </>
          ) : tab === 'contract' ? (
            <div className="py-4">
              {lease ? (
                <div className="rounded-lg border border-slate-200 p-4 text-sm">
                  <div className="mb-2 font-semibold text-slate-800">Contrato FL #{lease.leaseNumber} · {lease.status}</div>
                  <div className="grid grid-cols-2 gap-2 text-slate-600">
                    <div>Aluguel: <b>{money(lease.monthlyRent)}</b></div>
                    <div>Depósito: <b>{money(lease.securityDeposit)}</b></div>
                    <div>Inquilino: {lease.tenantName || '—'}</div>
                  </div>
                  <button onClick={onOpenLeasesTab} className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#22558c] hover:bg-slate-50">
                    Abrir na aba Leases →
                  </button>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                  Ainda não há contrato FL para esta casa.
                  <button onClick={onOpenLeasesTab} className="ml-2 rounded-lg bg-[#22558c] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                    + Criar contrato na aba Leases
                  </button>
                </div>
              )}
            </div>
          ) : tab === 'docs' ? (
            <div className="py-6 text-sm text-slate-500">
              Suba o arquivo do contrato desta casa pela lista (botão <b>Upload</b>). Geração automática de documentos (chaves, listing, administração) vem na próxima fase.
            </div>
          ) : (
            <div>
              {jobsLoading ? (
                <div className="py-8 text-center text-slate-400">Carregando chamados…</div>
              ) : !jobs || jobs.length === 0 ? (
                <div className="py-8 text-center text-slate-400">Nenhum chamado (job) registrado para esta casa.</div>
              ) : (
                <>
                  {(() => {
                    const vendors = Array.from(
                      jobs.reduce((mp, j) => {
                        const n = (j.vendorName || '').trim();
                        if (!n) return mp;
                        const d = (j.serviceDate || j.createdAt || '').slice(0, 10);
                        const prev = mp.get(n);
                        if (!prev || d > prev) mp.set(n, d);
                        return mp;
                      }, new Map<string, string>()),
                    );
                    return vendors.length ? (
                      <div className="mb-3">
                        <div className="mb-1 text-xs font-semibold uppercase text-slate-500">Vendors que atenderam</div>
                        <div className="flex flex-wrap gap-1.5">
                          {vendors.map(([n, d]) => (
                            <span key={n} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                              {n}{d ? ` · ${d}` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                        <th className="px-3 py-2">Data</th>
                        <th className="px-3 py-2">Tipo</th>
                        <th className="px-3 py-2">Vendor</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((j) => (
                        <tr key={j.id} className="border-b border-slate-100">
                          <td className="px-3 py-2 font-mono text-xs">{(j.serviceDate || j.createdAt || '').slice(0, 10)}</td>
                          <td className="px-3 py-2">{j.serviceType || j.description || '—'}</td>
                          <td className="px-3 py-2 text-slate-600">{j.vendorName || '—'}</td>
                          <td className="px-3 py-2"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{j.status || '—'}</span></td>
                          <td className="px-3 py-2 text-right font-mono">{money(j.ownerCharged)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
