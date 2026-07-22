'use client';

import { useCallback, useEffect, useState } from 'react';

/** Campos do formulário FL (modelo Heist/Weisse/Wolk) guardados em LeaseAgreement.leaseForm. */
type LeaseForm = Record<string, string | boolean>;

type LeaseDetail = {
  id: string;
  leaseNumber: number;
  contractCode?: string | null;
  status: string;
  propertyId: string;
  mgmtFeePct: string;
  monthlyRent: string;
  securityDeposit: string;
  securityReserve: string;
  lateFeeFlat: string;
  lateFeeDaily: string;
  startDate: string | null;
  endDate: string | null;
  attorneySentAt: string | null;
  qbInvoiceUrl: string | null;
  qbInvoiceId: string | null;
  leaseForm: LeaseForm | null;
  property?: { code: string | null; address: string | null; ownerName: string | null };
  tenant?: { name: string | null; email: string | null };
};

const FL_COUNTIES = ['Orange', 'Osceola', 'Polk', 'Lake', 'Seminole', 'Volusia', 'Miami-Dade', 'Broward', 'Palm Beach', 'Hillsborough', 'Outro'];

function money(n: unknown) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function LeaseDetailModal({ leaseId, clientId, onClose, onSaved }: { leaseId: string; clientId: string; onClose: () => void; onSaved?: () => void }) {
  const qs = clientId ? `?clientId=${encodeURIComponent(clientId)}` : '';
  const [lease, setLease] = useState<LeaseDetail | null>(null);
  const [form, setForm] = useState<LeaseForm>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<'form' | 'receipts' | 'payout' | 'docs' | 'jobs' | 'rescind'>('form');
  const [resc, setResc] = useState<{ securityDeposit: number; securityReserve: number; totalDeducted: number; depositBalance: number; moveOutDate: string | null; status: string; deductions: { id: string; description: string; amount: number }[] } | null>(null);
  const [dedDesc, setDedDesc] = useState('');
  const [dedAmount, setDedAmount] = useState('');
  const [leaseFee, setLeaseFee] = useState('');
  const [invBusy, setInvBusy] = useState(false);

  async function genInvoice() {
    const fee = Number(leaseFee);
    if (!(fee > 0)) { setMsg('Informe o valor do lease fee.'); return; }
    setInvBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/lease-agreements/${encodeURIComponent(leaseId)}/qb-invoice`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaseFee: fee }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { setMsg('Invoice gerada no QuickBooks.'); await load(); }
      else setMsg(j.error || `Erro ${r.status}`);
    } catch { setMsg('Erro de rede.'); } finally { setInvBusy(false); }
  }

  const loadResc = useCallback(async () => {
    const r = await fetch(`/api/lease-agreements/${encodeURIComponent(leaseId)}/rescind${qs}`, { credentials: 'include', cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (j?.ok) setResc(j);
  }, [leaseId, qs]);

  useEffect(() => {
    if (tab === 'rescind' && !resc) void loadResc();
  }, [tab, resc, loadResc]);

  async function rescAction(body: Record<string, unknown>) {
    setSaving(true);
    try {
      const r = await fetch(`/api/lease-agreements/${encodeURIComponent(leaseId)}/rescind`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        await loadResc();
        onSaved?.();
      } else setMsg(j.error || `Erro ${r.status}`);
    } finally {
      setSaving(false);
    }
  }
  const [propRow, setPropRow] = useState<{ months: string[]; cells: Record<string, { received: number; paid: number; expected: number }>; rent: number; owner: string } | null>(null);
  const [propLoading, setPropLoading] = useState(false);

  const loadPropData = useCallback(async () => {
    if (!lease?.propertyId) return;
    setPropLoading(true);
    try {
      const yr = new Date().getUTCFullYear();
      const r = await fetch(`/api/results/gl-matrix${qs ? qs + '&' : '?'}year=${yr}`, { credentials: 'include', cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (j?.ok) {
        const row = (j.rows || []).find((x: { propertyId: string }) => x.propertyId === lease.propertyId);
        if (row) setPropRow({ months: j.months || [], cells: row.cells || {}, rent: row.rent || 0, owner: row.owner || '' });
        else setPropRow({ months: j.months || [], cells: {}, rent: 0, owner: '' });
      }
    } finally {
      setPropLoading(false);
    }
  }, [lease?.propertyId, qs]);

  useEffect(() => {
    if ((tab === 'receipts' || tab === 'payout') && !propRow && lease?.propertyId) void loadPropData();
  }, [tab, propRow, lease?.propertyId, loadPropData]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/lease-agreements/${encodeURIComponent(leaseId)}${qs}`, { credentials: 'include', cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (j?.ok && j.lease) {
        const l = j.lease as LeaseDetail;
        setLease(l);
        // pré-preenche o formulário FL com o que já sabemos.
        const f: LeaseForm = { ...(l.leaseForm || {}) };
        if (!f.propertyAddress) f.propertyAddress = l.property?.address || '';
        if (!f.ownerName) f.ownerName = l.property?.ownerName || '';
        if (!f.tenantName) f.tenantName = l.tenant?.name || '';
        if (!f.monthlyRent) f.monthlyRent = l.monthlyRent || '';
        if (!f.securityDeposit) f.securityDeposit = l.securityDeposit || '';
        if (!f.leaseBegins) f.leaseBegins = (l.startDate || '').slice(0, 10);
        if (!f.leaseEnds) f.leaseEnds = (l.endDate || '').slice(0, 10);
        if (f.state === undefined) f.state = 'Florida';
        if (f.newOrRenewal === undefined) f.newOrRenewal = 'New lease';
        if (f.rentDueDay === undefined) f.rentDueDay = '1';
        if (f.lateChargeBegins === undefined) f.lateChargeBegins = '5';
        setForm(f);
      }
    } finally {
      setLoading(false);
    }
  }, [leaseId, qs]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  async function patch(body: Record<string, unknown>, okMsg: string) {
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/lease-agreements/${encodeURIComponent(leaseId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: clientId || undefined, ...body }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        setMsg(okMsg);
        onSaved?.();
        if (body.attorneySent !== undefined) void load();
      } else setMsg(j.error || `Erro ${r.status}`);
    } catch {
      setMsg('Erro de rede.');
    } finally {
      setSaving(false);
    }
  }

  function printForm() {
    const v = (k: string) => String(form[k] ?? '');
    const yn = (k: string) => (form[k] ? 'Yes' : 'No');
    const w = window.open('', '_blank', 'width=800,height=1000');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Lease Request #${lease?.leaseNumber || ''}</title>
      <style>body{font-family:Georgia,serif;color:#1a2332;padding:32px;line-height:1.5}h1{color:#22558c;font-size:22px}h2{font-size:14px;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:22px}table{width:100%;border-collapse:collapse}td{padding:4px 8px;font-size:13px;vertical-align:top}td.l{color:#555;width:45%}</style>
      </head><body>
      <h1>Law Offices of Heist, Weisse, &amp; Wolk, PLLC</h1>
      <div style="color:#666">Lease Services for Florida's Landlords and Property Management Professionals — Lease Request</div>
      <h2>Lease Setup</h2><table>
      <tr><td class="l">New Lease or Renewal</td><td>${v('newOrRenewal')}</td></tr>
      <tr><td class="l">Type of Lease</td><td>${v('leaseType') || 'Fully managed account'}</td></tr>
      <tr><td class="l">Who Signs the Lease</td><td>${v('whoSigns') || 'Owner'}</td></tr></table>
      <h2>Property</h2><table>
      <tr><td class="l">Property Address</td><td>${v('propertyAddress')}</td></tr>
      <tr><td class="l">Unit/Apt</td><td>${v('unit')}</td></tr>
      <tr><td class="l">City</td><td>${v('city')}</td></tr>
      <tr><td class="l">County</td><td>${v('county')}</td></tr>
      <tr><td class="l">State</td><td>${v('state')}</td></tr>
      <tr><td class="l">Zip Code</td><td>${v('zip')}</td></tr>
      <tr><td class="l">Owner's Name</td><td>${v('ownerName')}</td></tr></table>
      <h2>Lease Info</h2><table>
      <tr><td class="l">Tenant's Name (Lease Signer)</td><td>${v('tenantName')}</td></tr>
      <tr><td class="l">Pets Allowed</td><td>${yn('petsAllowed')}</td></tr>
      <tr><td class="l">Smoking Allowed</td><td>${yn('smokingAllowed')}</td></tr></table>
      <h2>Financial</h2><table>
      <tr><td class="l">Lease Begins</td><td>${v('leaseBegins')}</td></tr>
      <tr><td class="l">Lease Ends</td><td>${v('leaseEnds')}</td></tr>
      <tr><td class="l">Monthly Rent</td><td>$${v('monthlyRent')}</td></tr>
      <tr><td class="l">Rent Due Day</td><td>${v('rentDueDay')}</td></tr>
      <tr><td class="l">Date Late Charge Begins</td><td>${v('lateChargeBegins')}</td></tr>
      <tr><td class="l">Late Charge</td><td>$${String(lease?.lateFeeFlat || '')} + $${String(lease?.lateFeeDaily || '')}/day</td></tr>
      <tr><td class="l">Security Deposit</td><td>$${v('securityDeposit')}</td></tr>
      <tr><td class="l">Security Deposit Received</td><td>${yn('depositReceived')}</td></tr>
      <tr><td class="l">Notice to Vacate</td><td>${v('noticeToVacate') || '30 days'}</td></tr></table>
      <h2>Other</h2><table>
      <tr><td class="l">Additional Stipulations</td><td>${v('additionalStipulations')}</td></tr></table>
      <p style="margin-top:24px;font-size:11px;color:#888">Gerado no GodManager — Contrato #${lease?.leaseNumber || ''}.</p>
      <script>window.onload=function(){window.print();}</script>
      </body></html>`);
    w.document.close();
  }

  const inp = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#22558c]';
  const lbl = 'block text-xs font-medium text-slate-600 mb-1';
  const T = (k: string, label: string, type = 'text') => (
    <div>
      <label className={lbl}>{label}</label>
      <input className={inp} type={type} value={String(form[k] ?? '')} onChange={(e) => set(k, e.target.value)} />
    </div>
  );
  const C = (k: string, label: string) => (
    <label className="flex items-center gap-2 pt-6 text-sm text-slate-600">
      <input type="checkbox" checked={!!form[k]} onChange={(e) => set(k, e.target.checked)} /> {label}
    </label>
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Contrato #{lease?.leaseNumber ?? ''} — Formulário FL</h2>
            <p className="text-xs text-slate-500">
              {lease?.contractCode ? <span className="font-mono text-[#22558c]">{lease.contractCode} · </span> : null}
              Modelo Heist, Weisse &amp; Wolk. Preencha e gere o PDF para envio ao advogado.
            </p>
          </div>
          <button onClick={onClose} className="text-2xl text-slate-400 hover:text-slate-600">×</button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-4">
          {loading ? (
            <div className="py-10 text-center text-slate-400">Carregando…</div>
          ) : (
            <>
              {msg && <div className="mb-3 rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-700">{msg}</div>}
              <div className="mb-4 flex items-center gap-3 rounded-lg bg-amber-50 px-4 py-2 text-sm">
                <span className={lease?.attorneySentAt ? 'text-green-700' : 'text-amber-700'}>
                  {lease?.attorneySentAt ? `Enviado ao advogado em ${lease.attorneySentAt.slice(0, 10)}` : 'Ainda não enviado ao advogado'}
                </span>
                <button
                  onClick={() => patch({ attorneySent: !lease?.attorneySentAt }, 'Status de envio atualizado.')}
                  disabled={saving}
                  className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {lease?.attorneySentAt ? 'Marcar como NÃO enviado' : 'Marcar como enviado ao advogado'}
                </button>
              </div>

              <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
                {([['form', 'Formulário'], ['receipts', 'Recebimentos'], ['payout', 'Repasse'], ['docs', 'Documentos'], ['jobs', 'Chamados'], ['rescind', 'Rescisão']] as const).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setTab(k)}
                    className={`rounded-t-lg px-3 py-2 text-xs font-semibold ${tab === k ? 'bg-[#22558c] text-white' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === 'form' && (<>
              <div className="mb-4 rounded-lg border border-slate-200 p-3">
                <div className="mb-1 text-xs font-semibold uppercase text-slate-500">Invoice QuickBooks (lease fee)</div>
                {lease?.qbInvoiceUrl ? (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-green-700">✔ Invoice gerada.</span>
                    <a href={lease.qbInvoiceUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#22558c] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1c4675]">Abrir link de pagamento →</a>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="w-32">
                      <label className={lbl}>Lease fee ($)</label>
                      <input className={inp} type="number" value={leaseFee} onChange={(e) => setLeaseFee(e.target.value)} placeholder="Ex.: 250" />
                    </div>
                    <button onClick={genInvoice} disabled={invBusy} className="rounded-lg bg-[#22558c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1c4675] disabled:opacity-50">
                      {invBusy ? 'Gerando…' : 'Gerar invoice no QuickBooks'}
                    </button>
                    <span className="text-xs text-slate-400">Precisa do QuickBooks conectado.</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <label className={lbl}>New / Renewal</label>
                  <select className={inp} value={String(form.newOrRenewal ?? 'New lease')} onChange={(e) => set('newOrRenewal', e.target.value)}>
                    <option>New lease</option>
                    <option>Renewal</option>
                  </select>
                </div>
                {T('whoSigns', 'Who Signs')}
                {T('propertyAddress', 'Property Address')}
                {T('unit', 'Unit/Apt')}
                {T('city', 'City')}
                <div>
                  <label className={lbl}>County</label>
                  <select className={inp} value={String(form.county ?? '')} onChange={(e) => set('county', e.target.value)}>
                    <option value="">—</option>
                    {FL_COUNTIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                {T('zip', 'Zip')}
                {T('ownerName', "Owner's Name")}
                {T('tenantName', "Tenant's Name")}
                {T('leaseBegins', 'Lease Begins', 'date')}
                {T('leaseEnds', 'Lease Ends', 'date')}
                {T('monthlyRent', 'Monthly Rent ($)', 'number')}
                {T('rentDueDay', 'Rent Due Day')}
                {T('lateChargeBegins', 'Late Charge Begins (day)')}
                {T('securityDeposit', 'Security Deposit ($)', 'number')}
                {T('noticeToVacate', 'Notice to Vacate')}
                {C('petsAllowed', 'Pets Allowed')}
                {C('smokingAllowed', 'Smoking Allowed')}
                {C('depositReceived', 'Security Deposit Received')}
              </div>
              <div className="mt-3">
                <label className={lbl}>Additional Stipulations</label>
                <textarea className={inp} rows={2} value={String(form.additionalStipulations ?? '')} onChange={(e) => set('additionalStipulations', e.target.value)} />
              </div>
              </>)}

              {(tab === 'receipts' || tab === 'payout') && (
                <div>
                  {propLoading ? (
                    <div className="py-8 text-center text-slate-400">Carregando…</div>
                  ) : !propRow ? (
                    <div className="py-8 text-center text-slate-400">Sem dados do GL para este imóvel.</div>
                  ) : (
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
                        {propRow.months.filter((m) => propRow.cells[m]).map((m) => {
                          const c = propRow.cells[m];
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
                        {propRow.months.filter((m) => propRow.cells[m]).length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-3 py-8 text-center text-slate-400">Sem lançamentos no GL deste ano.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                  <p className="mt-2 text-xs text-slate-400">Fonte: General Ledger (AppFolio). Owner: {propRow?.owner || '—'} · taxa de gestão {lease?.mgmtFeePct || '8'}%.</p>
                </div>
              )}

              {tab === 'docs' && (
                <div className="py-6 text-sm text-slate-500">
                  Documentos do contrato (entrega de chaves, contrato de locação, autorização de listing, contrato de administração) — use a aba <b>Contratos por casa</b> para subir o arquivo. Geração automática dos documentos vem na próxima fase.
                </div>
              )}
              {tab === 'jobs' && (
                <div className="py-6 text-sm text-slate-500">
                  Chamados desta propriedade aparecem no detalhe por casa (menu Contratos → clique na casa → aba Chamados).
                </div>
              )}

              {tab === 'rescind' && (
                <div>
                  {!resc ? (
                    <div className="py-8 text-center text-slate-400">Carregando…</div>
                  ) : (
                    <>
                      {resc.moveOutDate && (
                        <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
                          Contrato rescindido — move-out em {resc.moveOutDate.slice(0, 10)}.
                        </div>
                      )}
                      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-lg border border-slate-200 p-3">
                          <div className="text-xs text-slate-500">Depósito de segurança</div>
                          <div className="font-mono text-lg font-bold">{money(resc.securityDeposit)}</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 p-3">
                          <div className="text-xs text-slate-500">Reserva de segurança</div>
                          <div className="font-mono text-lg font-bold">{money(resc.securityReserve)}</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 p-3">
                          <div className="text-xs text-slate-500">Deduzido</div>
                          <div className="font-mono text-lg font-bold text-red-700">{money(resc.totalDeducted)}</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 p-3">
                          <div className="text-xs text-slate-500">Saldo do depósito</div>
                          <div className={`font-mono text-lg font-bold ${resc.depositBalance < 0 ? 'text-red-700' : 'text-green-700'}`}>{money(resc.depositBalance)}</div>
                        </div>
                      </div>

                      <div className="mb-3 text-sm font-semibold text-slate-700">Custos que a casa teve (abatem do depósito)</div>
                      <table className="mb-3 w-full text-sm">
                        <tbody>
                          {resc.deductions.map((d) => (
                            <tr key={d.id} className="border-b border-slate-100">
                              <td className="px-2 py-2">{d.description}</td>
                              <td className="px-2 py-2 text-right font-mono text-red-700">{money(d.amount)}</td>
                              <td className="px-2 py-2 text-right">
                                {!resc.moveOutDate && (
                                  <button onClick={() => rescAction({ action: 'remove', deductionId: d.id })} className="text-xs text-slate-400 hover:text-red-600">remover</button>
                                )}
                              </td>
                            </tr>
                          ))}
                          {resc.deductions.length === 0 && (
                            <tr><td className="px-2 py-3 text-center text-slate-400" colSpan={3}>Nenhum custo lançado.</td></tr>
                          )}
                        </tbody>
                      </table>

                      {!resc.moveOutDate && (
                        <>
                          <div className="mb-4 flex flex-wrap items-end gap-2">
                            <div className="flex-1 min-w-[180px]">
                              <label className={lbl}>Descrição do custo</label>
                              <input className={inp} value={dedDesc} onChange={(e) => setDedDesc(e.target.value)} placeholder="Ex.: Pintura, limpeza, reparo…" />
                            </div>
                            <div className="w-28">
                              <label className={lbl}>Valor ($)</label>
                              <input className={inp} type="number" value={dedAmount} onChange={(e) => setDedAmount(e.target.value)} />
                            </div>
                            <button
                              onClick={() => {
                                const a = Number(dedAmount);
                                if (!dedDesc.trim() || !(a > 0)) return;
                                void rescAction({ action: 'add', description: dedDesc.trim(), amount: a });
                                setDedDesc('');
                                setDedAmount('');
                              }}
                              disabled={saving}
                              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                            >
                              + Adicionar custo
                            </button>
                          </div>
                          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
                            <button
                              onClick={() => {
                                const d = prompt('Confirmar rescisão. Data de move-out (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
                                if (!d) return;
                                if (!confirm('Rescindir o contrato e registrar o move-out? Esta ação encerra o contrato.')) return;
                                void rescAction({ action: 'confirm', moveOutDate: d });
                              }}
                              disabled={saving}
                              className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              Confirmar rescisão (move-out)
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button onClick={printForm} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Baixar PDF (imprimir)
          </button>
          <button onClick={() => patch({ leaseForm: form }, 'Formulário salvo.')} disabled={saving} className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
            {saving ? 'Salvando…' : 'Salvar formulário'}
          </button>
        </div>
      </div>
    </div>
  );
}
