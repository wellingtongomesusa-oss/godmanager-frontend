'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

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
  houses,
  onSelect,
  initialTab,
}: {
  propertyId: string;
  address: string;
  code: string;
  tenantName: string;
  clientId: string;
  onClose: () => void;
  onOpenLeasesTab?: () => void;
  houses?: { propertyId: string; address: string; code: string | null; tenantName: string | null }[];
  onSelect?: (propertyId: string) => void;
  initialTab?: string;
}) {
  const qs = clientId ? `?clientId=${encodeURIComponent(clientId)}` : '';
  type HouseTab = 'receipts' | 'payout' | 'contract' | 'docs' | 'jobs' | 'graphs' | 'whatsapp' | 'vendors' | 'logs' | 'eviction';
  const validTabs: HouseTab[] = ['receipts', 'payout', 'contract', 'docs', 'jobs', 'graphs', 'whatsapp', 'vendors', 'logs', 'eviction'];
  const [tab, setTab] = useState<HouseTab>(validTabs.includes(initialTab as HouseTab) ? (initialTab as HouseTab) : 'receipts');
  const [graphOpen, setGraphOpen] = useState<'received' | 'payout' | 'compare' | null>(null);
  const [stmtMonth, setStmtMonth] = useState(() => { const d = new Date(); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; });
  const [waList, setWaList] = useState<{ id: string; createdAt: string; label?: string | null; participants?: string[]; messageCount?: number; overview?: unknown; transcript?: { d?: string; s?: string; t?: string }[] }[] | null>(null);
  const [waText, setWaText] = useState('');
  const [waBusy, setWaBusy] = useState(false);
  const docFileRef = useRef<HTMLInputElement>(null);
  const [docBusy, setDocBusy] = useState(false);
  const [docMsg, setDocMsg] = useState('');

  async function docUpload(f: File | null) {
    if (!f) return;
    setDocBusy(true);
    setDocMsg('');
    try {
      const fd = new FormData();
      fd.append('file', f);
      const r = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/contract`, { method: 'POST', credentials: 'include', body: fd });
      const d = await r.json().catch(() => ({}));
      setDocMsg(r.ok && d.ok ? t('hd_doc_uploaded_ok','Documento enviado e salvo nesta casa.') : (d.error || `Erro ${r.status}`));
    } catch (e) {
      setDocMsg(e instanceof Error ? e.message : t('hd_upload_fail','Falha no upload.'));
    } finally {
      setDocBusy(false);
      if (docFileRef.current) docFileRef.current.value = '';
    }
  }

  // Gera um documento imprimível (administração, listing, recibo de chaves) com os dados da casa.
  function genDoc(kind: 'mgmt' | 'listing' | 'keys') {
    const titles: Record<string, string> = { mgmt: 'Contrato de Administração / Property Management Agreement', listing: 'Autorização de Listing / Exclusive Listing Agreement', keys: 'Entrega de Chaves / Keys Handover Receipt' };
    const owner = row?.owner || '________________________';
    const rent = lease?.monthlyRent ? `$${lease.monthlyRent}` : '________';
    const bodies: Record<string, string> = {
      mgmt: `<p>This Property Management Agreement is entered into between <b>Manager Prop LLC</b> ("Manager") and <b>${owner}</b> ("Owner") for the property located at <b>${address}</b> (${code}).</p><p>The Manager is authorized to manage, lease, collect rent, coordinate maintenance and disburse net proceeds to the Owner, in accordance with Florida Statutes Chapter 475 and FREC trust-accounting rules. Management fee as agreed. Monthly rent reference: ${rent}.</p>`,
      listing: `<p><b>Manager Prop LLC</b> is granted the exclusive right to list and market the property at <b>${address}</b> (${code}), owned by <b>${owner}</b>, for lease. Reference monthly rent: ${rent}.</p><p>This agreement authorizes advertising, showings and tenant screening in accordance with Florida law and Fair Housing requirements.</p>`,
      keys: `<p>Property: <b>${address}</b> (${code}).</p><p>Owner: <b>${owner}</b> · Tenant: <b>${tenantName || '________________'}</b>.</p><p>The undersigned acknowledges receipt of the keys/access devices for the above property on the date below.</p><table style="width:100%;border-collapse:collapse;margin-top:10px"><tr><td style="border:1px solid #ccc;padding:8px">Front door keys</td><td style="border:1px solid #ccc;padding:8px">Qty: ____</td></tr><tr><td style="border:1px solid #ccc;padding:8px">Mailbox / gate / remotes</td><td style="border:1px solid #ccc;padding:8px">Qty: ____</td></tr></table>`,
    };
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${titles[kind]}</title><style>body{font-family:Inter,Arial,sans-serif;color:#1a1a1c;max-width:760px;margin:40px auto;padding:0 24px;line-height:1.6;font-size:14px}h1{font-size:20px;border-bottom:2px solid #c47b28;padding-bottom:8px}.company{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#c47b28;font-weight:700}.sig{margin-top:60px;display:flex;gap:40px}.sig div{flex:1;border-top:1px solid #1a1a1c;padding-top:6px;font-size:12px;color:#4a4540}@media print{body{margin:0}}</style></head><body><div class="company">Manager Prop LLC · godmanager.com</div><h1>${titles[kind]}</h1>${bodies[kind]}<div class="sig"><div>Owner / Signatário</div><div>Manager Prop LLC</div></div><p style="margin-top:24px;font-size:11px;color:#8a8580">Documento gerado pelo GodManager. Revise com seu advogado antes de assinar.</p></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.focus(); }
    else setDocMsg(t('hd_popup_block','Permita popups para gerar o documento.'));
  }

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
  const [logs, setLogs] = useState<{ id: string; createdAt: string; content: string; authorName?: string | null }[] | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);

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

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const r = await fetch(`/api/comments?entityType=PROPERTY&entityId=${encodeURIComponent(propertyId)}`, { credentials: 'include', cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      setLogs(Array.isArray(j?.comments) ? j.comments : []);
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    if ((tab === 'jobs' || tab === 'vendors') && jobs === null) void loadJobs();
  }, [tab, jobs, loadJobs]);

  useEffect(() => {
    if (tab === 'logs' && logs === null) void loadLogs();
  }, [tab, logs, loadLogs]);

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
  const parentNav = (k: string) => { const p = window.parent as unknown as { nav?: (k: string) => void }; p.nav?.(k); };
  // i18n: reusa o dicionário do monólito (window.parent.t) e re-renderiza ao trocar de idioma.
  const [lang, setLang] = useState<string>(() => { try { return localStorage.getItem('gm_lang') || 'en'; } catch { return 'en'; } });
  useEffect(() => {
    const onMsg = (e: MessageEvent) => { const d = e.data as { type?: string; lang?: string }; if (d && d.type === 'gm-lang' && d.lang) setLang(d.lang); };
    const onStorage = (e: StorageEvent) => { if (e.key === 'gm_lang' && e.newValue) setLang(e.newValue); };
    window.addEventListener('message', onMsg);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('message', onMsg); window.removeEventListener('storage', onStorage); };
  }, []);
  const t = useCallback((key: string, fallback: string) => {
    try { const pt = (window.parent as unknown as { t?: (k: string) => string }).t; if (pt) { const v = pt(key); if (v && v !== key) return v; } } catch { /* noop */ }
    return fallback;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);
  // Nível 1 — abas de SEÇÃO (idênticas às barras do monólito: #1a1a1c ativo / transparente inativo).
  const secBtn = (label: string, active: boolean, navKey: string | null) => (
    <button
      key={label}
      onClick={() => { if (navKey) parentNav(navKey); }}
      style={{
        padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
        borderRadius: '8px 8px 0 0', background: active ? '#1a1a1c' : 'transparent', color: active ? '#fff' : '#4a4540',
      }}
    >
      {label}
    </button>
  );
  // Nível 2 — abas da CASA selecionada.
  const tabBtn = (k: typeof tab, label: string) => (
    <button key={k} onClick={() => setTab(k)} className={`rounded-t-lg px-3 py-2 text-xs font-semibold ${tab === k ? 'bg-[#22558c] text-white' : 'text-slate-500 hover:text-slate-700'}`}>
      {label}
    </button>
  );

  return (
    <div className="w-full px-6 pt-2 sm:px-8">
      <div className="flex w-full flex-col">
        {/* TODAS as abas em UMA linha (seções + abas da casa) */}
        <div className="flex flex-wrap items-center gap-0.5 border-b border-[#e2ddd4]">
          {secBtn(t('pay_tab_contracts', 'Contratos por casa'), true, null)}
          {secBtn(t('pay_tab_receivables', 'Recebimentos'), false, 'recebimentos')}
          {secBtn(t('pay_tab_payables', 'Contas a Pagar'), false, 'ltownerpay')}
          {secBtn(t('pay_tab_payreceipt', 'Pay/Receipt'), false, 'renovations')}
          <span className="mx-1 h-5 w-px bg-slate-300" />
          {tabBtn('receipts', t('house_tab_rents', 'Aluguéis'))}
          {tabBtn('payout', t('house_tab_payout', 'Repasse'))}
          {tabBtn('contract', t('house_tab_contract', 'Contrato'))}
          {tabBtn('docs', t('house_tab_documents', 'Documentos'))}
          {tabBtn('jobs', t('house_tab_jobs', 'Chamados'))}
          {tabBtn('vendors', t('house_tab_vendors', 'Vendors'))}
          {tabBtn('graphs', t('house_tab_graphs', 'Gráficos'))}
          {tabBtn('whatsapp', t('house_tab_whatsapp', 'WhatsApp histórico'))}
          {tabBtn('logs', t('house_tab_logs', 'Logs'))}
          {tabBtn('eviction', t('house_tab_eviction', 'Eviction'))}
          <div className="ml-auto flex items-center gap-2 pb-1">
            <button
              onClick={() => { const p = window.parent as unknown as { gmContratosGoto?: (t: string) => void }; p.gmContratosGoto ? p.gmContratosGoto('leases') : undefined; }}
              className="rounded-lg bg-[#2a6e4e] px-3.5 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              {t('pay_new_contract', '+ Novo contrato')}
            </button>
            <input type="month" value={stmtMonth} onChange={(e) => setStmtMonth(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs" />
            <a
              href={`/api/manager-pro/owner-statement/pdf?propertyId=${encodeURIComponent(propertyId)}&period=${encodeURIComponent(stmtMonth)}&lang=${encodeURIComponent(lang)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-[#22558c] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1c4675]"
            >
              {t('pay_gen_statement', 'Gerar statement (PDF)')}
            </a>
          </div>
        </div>

        {/* Linha de baixo: SÓ o seletor de casa */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 py-2">
          <span className="text-xs font-semibold text-slate-500">{t('pay_house_label', 'Casa:')}</span>
          <select
            value={propertyId}
            onChange={(e) => onSelect?.(e.target.value)}
            className="max-w-[320px] rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            title={t('pay_house_select', 'Selecionar casa')}
          >
            {(houses || []).map((h) => (
              <option key={h.propertyId} value={h.propertyId}>{(h.code ? h.code + ' · ' : '') + h.address}</option>
            ))}
          </select>
          <button onClick={onClose} className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100" title={t('pay_all_houses', 'Todas as casas')}>{t('pay_all_houses', 'Todas as casas')}</button>
        </div>

        <div className="px-1 py-2 text-xs text-slate-500">
          <b className="text-sm text-slate-800">{address}</b> · {code} · {t('hd_tenant','Inquilino')}: {tenantName || '—'} {row?.owner ? `· ${t('col_owner','Owner')}: ${row.owner}` : ''}
        </div>

        <div className="flex-1 overflow-auto px-1 py-2">
          {loading ? (
            <div className="py-10 text-center text-slate-400">{t('receb_loading','Carregando…')}</div>
          ) : (tab === 'receipts' || tab === 'payout') ? (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <th className="px-3 py-2">{t('receb_month','Mês')}</th>
                    {tab === 'receipts' ? (
                      <th className="px-3 py-2 text-right">{t('hd_received_gl','Recebido (GL 4100)')}</th>
                    ) : (
                      <>
                        <th className="px-3 py-2 text-right">{t('hd_expected_payout','Repasse esperado')}</th>
                        <th className="px-3 py-2 text-right">{t('glm_paid_owner','Pago ao owner')}</th>
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
                      <td colSpan={3} className="px-3 py-8 text-center text-slate-400">{t('hd_no_gl_year','Sem lançamentos no GL deste ano.')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-slate-400">{t('hd_source_gl','Fonte: General Ledger (AppFolio).')}</p>
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
                  {t('hd_no_contract','Ainda não há contrato FL para esta casa.')}
                  <button onClick={onOpenLeasesTab} className="ml-2 rounded-lg bg-[#22558c] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                    {t('hd_create_contract','+ Criar contrato na aba Leases')}
                  </button>
                </div>
              )}
            </div>
          ) : tab === 'docs' ? (
            <div className="py-4">
              <input ref={docFileRef} type="file" accept=".pdf,.doc,.docx,image/png,image/jpeg" className="hidden" onChange={(e) => void docUpload(e.target.files?.[0] || null)} />
              <div className="mb-5">
                <div className="mb-2 text-sm font-semibold text-slate-700">{t('hd_upload_doc_title','Enviar documento (upload)')}</div>
                <button onClick={() => docFileRef.current?.click()} disabled={docBusy} className="rounded-lg bg-[#22558c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1c4675] disabled:opacity-60">
                  {docBusy ? t('hd_sending','Enviando…') : t('hd_send_doc','Enviar documento')}
                </button>
                <p className="mt-1 text-xs text-slate-400">{t('hd_upload_note','PDF, DOC, DOCX ou imagem — fica salvo nesta casa')} ({code}).</p>
                {docMsg && <p className="mt-2 text-xs font-medium text-slate-600">{docMsg}</p>}
              </div>
              <div className="border-t border-slate-100 pt-4">
                <div className="mb-2 text-sm font-semibold text-slate-700">{t('hd_gen_doc_title','Gerar contrato / documento')}</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { const p = window.parent as unknown as { gmContratosGoto?: (t: string) => void }; p.gmContratosGoto ? p.gmContratosGoto('leases') : undefined; }}
                    className="rounded-lg bg-[#2a6e4e] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    {t('hd_gen_lease','Gerar contrato de locação (Lease FL)')}
                  </button>
                  <button onClick={() => genDoc('keys')} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-[#22558c] hover:bg-slate-50">{t('hd_doc_keys','Entrega de chaves')}</button>
                  <button onClick={() => genDoc('listing')} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-[#22558c] hover:bg-slate-50">{t('hd_doc_listing','Autorização de listing')}</button>
                  <button onClick={() => genDoc('mgmt')} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-[#22558c] hover:bg-slate-50">{t('hd_doc_mgmt','Contrato de administração')}</button>
                </div>
                <p className="mt-2 text-xs text-slate-400">{t('hd_gen_note','O contrato de locação (Lease FL) é criado na aba Leases com número único vinculado a esta casa. Os demais abrem um modelo imprimível com os dados da casa.')}</p>
              </div>
            </div>
          ) : tab === 'graphs' ? (
            <div className="py-4">
              <div className="mb-3 text-sm text-slate-600">{t('hd_open_graphs','Abra os gráficos desta casa em popup:')}</div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setGraphOpen('received')} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-[#22558c] hover:bg-slate-50">{t('hd_g_received_month','Recebido por mês')}</button>
                <button onClick={() => setGraphOpen('payout')} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-[#22558c] hover:bg-slate-50">{t('hd_g_payout','Repasse (esperado × pago)')}</button>
                <button onClick={() => setGraphOpen('compare')} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-[#22558c] hover:bg-slate-50">{t('hd_g_compare','Recebido × Pago')}</button>
              </div>
              {monthsWith.length === 0 && <p className="mt-3 text-xs text-slate-400">{t('hd_no_gl_charts','Sem dados do GL para gerar gráficos.')}</p>}
            </div>
          ) : tab === 'whatsapp' ? (
            <div className="py-2">
              <div className="mb-2 text-xs font-semibold uppercase text-slate-500">{t('hd_wa_add','Adicionar conversa de WhatsApp')}</div>
              <textarea
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#22558c]"
                rows={4}
                placeholder={t('hd_wa_ph','Cole aqui a conversa exportada do WhatsApp desta casa…')}
                value={waText}
                onChange={(e) => setWaText(e.target.value)}
              />
              <div className="mt-2 flex justify-end">
                <button onClick={waSubmit} disabled={waBusy || !waText.trim()} className="rounded-lg bg-[#25d366] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                  {waBusy ? t('hd_saving','Salvando…') : t('hd_wa_add_btn','Adicionar ao histórico')}
                </button>
              </div>
              <div className="mt-4 space-y-2">
                {waList === null ? (
                  <div className="py-6 text-center text-slate-400">{t('receb_loading','Carregando…')}</div>
                ) : waList.length === 0 ? (
                  <div className="py-6 text-center text-slate-400">{t('hd_wa_none','Nenhuma conversa registrada para esta casa.')}</div>
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
          ) : tab === 'vendors' ? (
            <div className="py-2">
              {jobsLoading ? (
                <div className="py-8 text-center text-slate-400">{t('receb_loading','Carregando…')}</div>
              ) : !jobs || jobs.filter((j) => (j.vendorName || '').trim()).length === 0 ? (
                <div className="py-8 text-center text-slate-400">{t('hd_v_none','Nenhum vendor atendeu esta casa ainda.')}</div>
              ) : (
                <div className="space-y-3">
                  {(() => {
                    const byV = new Map<string, Job[]>();
                    jobs.forEach((j) => { const n = (j.vendorName || '').trim(); if (!n) return; const a = byV.get(n) || []; a.push(j); byV.set(n, a); });
                    return Array.from(byV.entries()).map(([n, js]) => (
                      <div key={n} className="overflow-hidden rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2">
                          <b className="text-sm text-slate-800">{n}</b>
                          <span className="text-xs text-slate-500">{js.length} {t('hd_v_services','atendimento(s)')}</span>
                        </div>
                        <table className="w-full text-sm">
                          <tbody>
                            {js.slice().sort((a, b) => ((b.serviceDate || b.createdAt || '') > (a.serviceDate || a.createdAt || '') ? 1 : -1)).map((j) => (
                              <tr key={j.id} className="border-b border-slate-100 last:border-0">
                                <td className="px-3 py-1.5 font-mono text-xs text-slate-500">{(j.serviceDate || j.createdAt || '').slice(0, 10)}</td>
                                <td className="px-3 py-1.5">{j.serviceType || j.description || '—'}</td>
                                <td className="px-3 py-1.5 text-right font-mono">{money(j.ownerCharged)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          ) : tab === 'logs' ? (
            <div className="py-2">
              {logsLoading ? (
                <div className="py-8 text-center text-slate-400">{t('receb_loading','Carregando…')}</div>
              ) : !logs || logs.length === 0 ? (
                <div className="py-8 text-center text-slate-400">{t('hd_logs_none','Nenhum registro no histórico desta casa.')}</div>
              ) : (
                <div className="space-y-2">
                  {logs.slice().reverse().map((l) => (
                    <div key={l.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-1 text-[10px] text-slate-400">{(l.createdAt || '').slice(0, 16).replace('T', ' ')}{l.authorName ? ` · ${l.authorName}` : ''}</div>
                      <div className="whitespace-pre-wrap text-sm text-slate-700">{l.content}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : tab === 'eviction' ? (
            <div className="py-6 text-sm">
              {lease && lease.status === 'TERMINATED' ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-800">
                  {t('hd_evic_contract','Contrato')} {lease.contractCode || `#${lease.leaseNumber}`} {t('hd_evic_terminated_post','rescindido — move-out/terminação registrada.')}
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-600">
                  {t('hd_evic_none','Nenhum despejo (eviction) ou rescisão registrada para esta casa.')}
                </div>
              )}
              <p className="mt-3 text-xs text-slate-400">{t('hd_evic_note','O histórico de despejo é alimentado pelas rescisões de contrato (aba Rescisão) e registros de move-out. Ações formais de eviction podem ser anotadas nos Logs.')}</p>
            </div>
          ) : (
            <div>
              {jobsLoading ? (
                <div className="py-8 text-center text-slate-400">{t('hd_jobs_loading','Carregando chamados…')}</div>
              ) : !jobs || jobs.length === 0 ? (
                <div className="py-8 text-center text-slate-400">{t('hd_jobs_none','Nenhum chamado (job) registrado para esta casa.')}</div>
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
                        <div className="mb-1 text-xs font-semibold uppercase text-slate-500">{t('hd_vendors_served','Vendors que atenderam')}</div>
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
                        <th className="px-3 py-2">{t('hd_th_date','Data')}</th>
                        <th className="px-3 py-2">{t('hd_th_type','Tipo')}</th>
                        <th className="px-3 py-2">{t('op_th_vendor','Vendor')}</th>
                        <th className="px-3 py-2">{t('col_status','Status')}</th>
                        <th className="px-3 py-2 text-right">{t('hd_th_amount','Valor')}</th>
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
