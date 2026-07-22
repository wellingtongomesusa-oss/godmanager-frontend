'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type PropOpt = { propertyId: string; code: string | null; address: string; tenantName: string | null };
type Lease = {
  id: string;
  leaseNumber: number;
  status: string;
  propertyCode: string;
  propertyAddress: string;
  owner: string;
  tenantName: string;
  monthlyRent: string;
  rentPeriod: string;
  securityDeposit: string;
  startDate: string | null;
  endDate: string | null;
};

const PERIODS = [
  { v: 'MONTHLY', l: 'Mensal' },
  { v: 'BIWEEKLY', l: 'Quinzenal' },
  { v: 'WEEKLY', l: 'Semanal' },
];

function money(n: unknown) {
  const v = Number(n || 0);
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function LeasesAdmin({ clientId }: { clientId: string }) {
  const qs = clientId ? `?clientId=${encodeURIComponent(clientId)}` : '';
  const [props, setProps] = useState<PropOpt[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [propSearch, setPropSearch] = useState('');

  const [form, setForm] = useState({
    propertyId: '',
    monthlyRent: '',
    rentPeriod: 'MONTHLY',
    mgmtFeePct: '8',
    tenantPlacementPct: '',
    lateFeeFlat: '150',
    lateFeeDaily: '5',
    securityDeposit: '',
    securityReserve: '',
    is1099: false,
    hoaEnabled: false,
    hoaValue: '',
    startDate: '',
    endDate: '',
    notes: '',
  });
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pr, lr] = await Promise.all([
        fetch('/api/contracts' + qs, { credentials: 'include', cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
        fetch('/api/lease-agreements' + qs, { credentials: 'include', cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
      ]);
      if (pr?.ok && Array.isArray(pr.properties)) setProps(pr.properties);
      if (lr?.ok && Array.isArray(lr.leases)) setLeases(lr.leases);
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredProps = useMemo(() => {
    const q = propSearch.trim().toLowerCase();
    if (!q) return props.slice(0, 300);
    return props.filter((p) => `${p.code || ''} ${p.address} ${p.tenantName || ''}`.toLowerCase().includes(q)).slice(0, 300);
  }, [props, propSearch]);

  const selectedProp = props.find((p) => p.propertyId === form.propertyId) || null;

  async function submit() {
    if (!form.propertyId) {
      setMsg({ ok: false, text: 'Selecione o imóvel.' });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const body = {
        clientId: clientId || undefined,
        propertyId: form.propertyId,
        monthlyRent: Number(form.monthlyRent) || 0,
        rentPeriod: form.rentPeriod,
        mgmtFeePct: Number(form.mgmtFeePct) || 8,
        tenantPlacementPct: form.tenantPlacementPct === '' ? null : Number(form.tenantPlacementPct),
        lateFeeFlat: Number(form.lateFeeFlat) || 150,
        lateFeeDaily: Number(form.lateFeeDaily) || 5,
        securityDeposit: Number(form.securityDeposit) || 0,
        securityReserve: Number(form.securityReserve) || 0,
        is1099: form.is1099,
        hoaEnabled: form.hoaEnabled,
        hoaValue: form.hoaValue === '' ? null : Number(form.hoaValue),
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        notes: form.notes || null,
      };
      const r = await fetch('/api/lease-agreements', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        setMsg({ ok: true, text: `Contrato #${j.leaseNumber} criado.` });
        setShowForm(false);
        setForm((f) => ({ ...f, propertyId: '', monthlyRent: '', securityDeposit: '', securityReserve: '', notes: '' }));
        void load();
      } else {
        setMsg({ ok: false, text: j.error || `Erro ${r.status}` });
      }
    } catch {
      setMsg({ ok: false, text: 'Erro de rede.' });
    } finally {
      setLoading(false);
    }
  }

  const inp = 'rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#22558c]';
  const lbl = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <div className="w-full px-6 py-6 sm:px-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Leases / Contratos (Flórida)</h2>
          <p className="text-sm text-slate-500">Crie e gerencie contratos de locação — nº único por casa, com depósito, HOA, late fee e 1099.</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-[#22558c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1c4675]"
        >
          {showForm ? 'Fechar' : '+ Novo Contrato'}
        </button>
      </div>

      {msg && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>
      )}

      {showForm && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3">
            <label className={lbl}>Imóvel (busque por endereço, código ou inquilino)</label>
            <input className={`${inp} w-full mb-2`} placeholder="Buscar imóvel…" value={propSearch} onChange={(e) => setPropSearch(e.target.value)} />
            <select className={`${inp} w-full`} value={form.propertyId} onChange={(e) => set('propertyId', e.target.value)}>
              <option value="">— Selecione o imóvel —</option>
              {filteredProps.map((p) => (
                <option key={p.propertyId} value={p.propertyId}>
                  {(p.code ? p.code + ' · ' : '') + p.address + (p.tenantName ? ' — ' + p.tenantName : '')}
                </option>
              ))}
            </select>
            {selectedProp && <p className="mt-1 text-xs text-slate-500">Inquilino atual: {selectedProp.tenantName || '—'}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className={lbl}>Aluguel</label>
              <input className={`${inp} w-full`} type="number" value={form.monthlyRent} onChange={(e) => set('monthlyRent', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Período</label>
              <select className={`${inp} w-full`} value={form.rentPeriod} onChange={(e) => set('rentPeriod', e.target.value)}>
                {PERIODS.map((p) => (
                  <option key={p.v} value={p.v}>{p.l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Taxa de gestão %</label>
              <input className={`${inp} w-full`} type="number" step="0.1" value={form.mgmtFeePct} onChange={(e) => set('mgmtFeePct', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Tenant placement %</label>
              <input className={`${inp} w-full`} type="number" step="0.1" value={form.tenantPlacementPct} onChange={(e) => set('tenantPlacementPct', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Late fee fixo ($)</label>
              <input className={`${inp} w-full`} type="number" value={form.lateFeeFlat} onChange={(e) => set('lateFeeFlat', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Late fee por dia ($)</label>
              <input className={`${inp} w-full`} type="number" value={form.lateFeeDaily} onChange={(e) => set('lateFeeDaily', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Depósito de segurança ($)</label>
              <input className={`${inp} w-full`} type="number" value={form.securityDeposit} onChange={(e) => set('securityDeposit', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Reserva de segurança ($)</label>
              <input className={`${inp} w-full`} type="number" value={form.securityReserve} onChange={(e) => set('securityReserve', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Início</label>
              <input className={`${inp} w-full`} type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Fim</label>
              <input className={`${inp} w-full`} type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>HOA</label>
              <div className="flex items-center gap-2 pt-2">
                <input id="hoaEnabled" type="checkbox" checked={form.hoaEnabled} onChange={(e) => set('hoaEnabled', e.target.checked)} />
                <input className={`${inp} flex-1`} type="number" placeholder="Valor HOA" disabled={!form.hoaEnabled} value={form.hoaValue} onChange={(e) => set('hoaValue', e.target.value)} />
              </div>
            </div>
            <div>
              <label className={lbl}>1099</label>
              <label className="flex items-center gap-2 pt-2 text-sm text-slate-600">
                <input type="checkbox" checked={form.is1099} onChange={(e) => set('is1099', e.target.checked)} /> Gerar 1099
              </label>
            </div>
          </div>
          <div className="mt-3">
            <label className={lbl}>Observações</label>
            <textarea className={`${inp} w-full`} rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={submit} disabled={loading} className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {loading ? 'Salvando…' : 'Criar contrato'}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Imóvel</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Inquilino</th>
              <th className="px-4 py-3 text-right">Aluguel</th>
              <th className="px-4 py-3 text-right">Depósito</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {leases.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  {loading ? 'Carregando…' : 'Nenhum contrato criado. Clique em “+ Novo Contrato”.'}
                </td>
              </tr>
            )}
            {leases.map((l) => (
              <tr key={l.id} className="border-b border-slate-100">
                <td className="px-4 py-3 font-mono text-slate-600">{l.leaseNumber}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{l.propertyAddress}</div>
                  <div className="font-mono text-xs text-slate-400">{l.propertyCode}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{l.owner || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{l.tenantName || '—'}</td>
                <td className="px-4 py-3 text-right font-mono">{money(l.monthlyRent)}</td>
                <td className="px-4 py-3 text-right font-mono">{money(l.securityDeposit)}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{l.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
