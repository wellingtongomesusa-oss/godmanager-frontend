'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';

type Cell = { received: number; paid: number; expected: number };
type MatrixRow = { propertyId: string; owner: string; rent: number; months: string[]; cells: Record<string, Cell> };
type LeaseLite = { id: string; leaseNumber: number; contractCode?: string; status: string; monthlyRent: string; securityDeposit: string; tenantName: string };
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
  const [tab, setTab] = useState<'receipts' | 'payout' | 'contract' | 'docs' | 'jobs' | 'graphs' | 'whatsapp'>('receipts');
  const [graphOpen, setGraphOpen] = useState<'received' | 'payout' | 'compare' | null>(null);
  const [stmtMonth, setStmtMonth] = useState(() => { const d = new Date(); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; });
  const [waList, setWaList] = useState<{ id: string; createdAt: string; label?: string | null; participants?: string[]; messageCount?: number; overview?: unknown; transcript?: { d?: string; s?: string; t?: string }[] }[] | null>(null);
  const [waText, setWaText] = useState('');
  const [waBusy, setWaBusy] = useState(false);

  const loadWa = useCallback(async () => {
    try {
      const r = await fetch(`/api/whatsapp/list?propertyId=${encodeURIComponent(propertyId)}`, { credentials: 'include', cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      setWaList(Array.isArray(j?.conversations) ? j.conversations : []);
    } catch { setWaList([]); }
  }, [propertyId]);

  async function waSubmit() {
    const text = waText.trim();
    if (!text) return;
    setWaBusy(true);
    try {
      const r = await fetch('/api/whatsapp/ingest', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId, text }) });
      if (r.ok) { setWaText(''); await loadWa(); }
    } finally { setWaBusy(false); }
  }
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

  useEffect(() => {
    if (tab === 'whatsapp' && waList === null) void loadWa();
  }, [tab, waList, loadWa]);

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
    <div className="w-full px-6 py-4 sm:px-8">
      <div className="flex w-full flex-col rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">← Voltar</button>
            <div>
              <h2 className="text-lg font-bold text-slate-800">{address}</h2>
              <p className="text-xs text-slate-500">
                {code} · Inquilino: {tenantName || '—'} {row?.owner ? `· Owner: ${row.owner}` : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-6 pt-3">
          {tabBtn('receipts', 'Recebimentos')}
          {tabBtn('payout', 'Repasse')}
          {tabBtn('contract', 'Contrato')}
          {tabBtn('docs', 'Documentos')}
          {tabBtn('jobs', 'Chamados')}
          {tabBtn('graphs', 'Gráficos')}
          {tabBtn('whatsapp', 'WhatsApp histórico')}
          <div className="ml-auto flex items-center gap-2 pb-2">
            <input type="month" value={stmtMonth} onChange={(e) => setStmtMonth(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs" />
            <a
              href={`/api/manager-pro/owner-statement/pdf?propertyId=${encodeURIComponent(propertyId)}&period=${encodeURIComponent(stmtMonth)}&lang=en`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-[#22558c] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1c4675]"
            >
              📄 Gerar statement (PDF)
            </a>
          </div>
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
                  <div className="mb-1 font-semibold text-slate-800">Contrato FL #{lease.leaseNumber} · {lease.status}</div>
                  {lease.contractCode && <div className="mb-2 font-mono text-xs text-[#22558c]">{lease.contractCode}</div>}
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
          ) : tab === 'graphs' ? (
            <div className="py-4">
              <div className="mb-3 text-sm text-slate-600">Abra os gráficos desta casa em popup:</div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setGraphOpen('received')} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-[#22558c] hover:bg-slate-50">📈 Recebido por mês</button>
                <button onClick={() => setGraphOpen('payout')} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-[#22558c] hover:bg-slate-50">📈 Repasse (esperado × pago)</button>
                <button onClick={() => setGraphOpen('compare')} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-[#22558c] hover:bg-slate-50">📊 Recebido × Pago</button>
              </div>
              {monthsWith.length === 0 && <p className="mt-3 text-xs text-slate-400">Sem dados do GL para gerar gráficos.</p>}
            </div>
          ) : tab === 'whatsapp' ? (
            <div className="py-2">
              <div className="mb-2 text-xs font-semibold uppercase text-slate-500">Adicionar conversa de WhatsApp</div>
              <textarea
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#22558c]"
                rows={4}
                placeholder="Cole aqui a conversa exportada do WhatsApp desta casa…"
                value={waText}
                onChange={(e) => setWaText(e.target.value)}
              />
              <div className="mt-2 flex justify-end">
                <button onClick={waSubmit} disabled={waBusy || !waText.trim()} className="rounded-lg bg-[#25d366] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                  {waBusy ? 'Salvando…' : '📱 Adicionar ao histórico'}
                </button>
              </div>
              <div className="mt-4 space-y-2">
                {waList === null ? (
                  <div className="py-6 text-center text-slate-400">Carregando…</div>
                ) : waList.length === 0 ? (
                  <div className="py-6 text-center text-slate-400">Nenhuma conversa registrada para esta casa.</div>
                ) : (
                  waList.map((w) => (
                    <div key={w.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                        <span>{(w.createdAt || '').slice(0, 16).replace('T', ' ')}</span>
                        {w.label && <span className="font-semibold text-slate-600">{w.label}</span>}
                        {typeof w.messageCount === 'number' && <span>{w.messageCount} msgs</span>}
                        {w.participants && w.participants.length > 0 && <span>· {w.participants.join(', ')}</span>}
                      </div>
                      {typeof w.overview === 'string' && w.overview && (
                        <div className="mb-2 whitespace-pre-wrap rounded bg-white p-2 text-xs text-slate-700">{w.overview}</div>
                      )}
                      {w.transcript && w.transcript.length > 0 && (
                        <div className="max-h-40 space-y-0.5 overflow-auto text-[11px] text-slate-600">
                          {w.transcript.slice(0, 200).map((m, i) => (
                            <div key={i}><span className="text-slate-400">{m.d} </span><b>{m.s}:</b> {m.t}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
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

      {graphOpen && row && (() => {
        const series = monthsWith.map((m) => ({ m, c: row.cells[m] }));
        const title = graphOpen === 'received' ? 'Recebido por mês' : graphOpen === 'payout' ? 'Repasse: esperado × pago' : 'Recebido × Pago';
        let max = 1;
        series.forEach((s) => { max = Math.max(max, s.c.received, s.c.paid, s.c.expected); });
        const W = Math.max(360, series.length * 70), H = 220, pad = 30;
        const bw = series.length ? (W - pad * 2) / series.length : 0;
        return (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4" onClick={() => setGraphOpen(null)}>
            <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div className="text-base font-bold text-slate-800">{address} — {title}</div>
                <button onClick={() => setGraphOpen(null)} className="text-2xl text-slate-400 hover:text-slate-600">×</button>
              </div>
              <div className="overflow-x-auto px-6 py-4">
                {series.length === 0 ? (
                  <div className="py-8 text-center text-slate-400">Sem dados.</div>
                ) : (
                  <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: Math.min(W, 700) }}>
                    {series.map((s, i) => {
                      const x = pad + i * bw;
                      const bars: ReactNode[] = [];
                      if (graphOpen === 'received') {
                        const h = (s.c.received / max) * (H - pad * 2);
                        bars.push(<rect key="r" x={x + bw * 0.25} y={H - pad - h} width={bw * 0.5} height={h} fill="#2a6e4e" />);
                      } else if (graphOpen === 'payout') {
                        const he = (s.c.expected / max) * (H - pad * 2), hp = (s.c.paid / max) * (H - pad * 2);
                        bars.push(<rect key="e" x={x + bw * 0.15} y={H - pad - he} width={bw * 0.3} height={he} fill="#22558c" />);
                        bars.push(<rect key="p" x={x + bw * 0.55} y={H - pad - hp} width={bw * 0.3} height={hp} fill="#b83030" />);
                      } else {
                        const hr = (s.c.received / max) * (H - pad * 2), hp = (s.c.paid / max) * (H - pad * 2);
                        bars.push(<rect key="r" x={x + bw * 0.15} y={H - pad - hr} width={bw * 0.3} height={hr} fill="#2a6e4e" />);
                        bars.push(<rect key="p" x={x + bw * 0.55} y={H - pad - hp} width={bw * 0.3} height={hp} fill="#b83030" />);
                      }
                      return (
                        <g key={s.m}>
                          {bars}
                          <text x={x + bw * 0.5} y={H - pad + 14} fontSize="9" textAnchor="middle" fill="#999">{s.m.slice(2)}</text>
                        </g>
                      );
                    })}
                  </svg>
                )}
                <div className="mt-2 text-xs text-slate-400">
                  {graphOpen === 'received' ? 'Verde: recebido (GL 4100).' : graphOpen === 'payout' ? 'Azul: repasse esperado · Vermelho: pago ao owner.' : 'Verde: recebido · Vermelho: pago ao owner.'}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
