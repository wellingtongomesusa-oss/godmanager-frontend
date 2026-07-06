'use client';

import { useCallback, useEffect, useState } from 'react';
import { Ticket, Plus, RefreshCw } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';

type Coupon = {
  id: string;
  code: string;
  name: string | null;
  discountType: 'PERCENT' | 'FIXED';
  percentOff: number | null;
  amountOffCents: number | null;
  duration: string;
  durationInMonths: number | null;
  maxRedemptions: number | null;
  timesRedeemed: number;
  active: boolean;
  createdAt: string;
  redemptionCount: number;
  discountGivenCents: number;
};

const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);

function discountLabel(c: Coupon): string {
  if (c.discountType === 'PERCENT') return `${c.percentOff}% off`;
  return `${money(c.amountOffCents || 0)} off`;
}
function durationLabel(c: Coupon): string {
  if (c.duration === 'forever') return 'sempre';
  if (c.duration === 'repeating') return `${c.durationInMonths || 0} meses`;
  return '1ª cobrança';
}

export function CouponsAdmin() {
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [value, setValue] = useState('');
  const [duration, setDuration] = useState<'once' | 'forever' | 'repeating'>('once');
  const [durationInMonths, setDurationInMonths] = useState('3');
  const [maxRedemptions, setMaxRedemptions] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/coupons', { credentials: 'include', cache: 'no-store' });
      const d = await r.json();
      if (d?.ok) setCoupons(d.coupons || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (user && String(user.role).toLowerCase() !== 'super_admin') {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center text-slate-500">
        Acesso restrito ao super administrador da plataforma.
      </div>
    );
  }

  const create = async () => {
    setMsg(null);
    const v = Number(value);
    if (!code.trim() || !Number.isFinite(v) || v <= 0) {
      setMsg({ ok: false, text: 'Informe código e um valor válido.' });
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/admin/coupons', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim() || undefined,
          discountType,
          value: v,
          duration,
          durationInMonths: duration === 'repeating' ? Number(durationInMonths) : undefined,
          maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
        }),
      });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.ok) {
        setMsg({ ok: true, text: `Cupom ${d.coupon.code} criado.` });
        setCode('');
        setName('');
        setValue('');
        setMaxRedemptions('');
        await load();
      } else {
        setMsg({
          ok: false,
          text:
            d?.error === 'stripe_not_configured'
              ? 'Stripe não configurado. Configure as chaves primeiro.'
              : d?.error || 'Falha ao criar cupom.',
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const totalRedemptions = coupons.reduce((s, c) => s + c.redemptionCount, 0);
  const totalDiscount = coupons.reduce((s, c) => s + c.discountGivenCents, 0);

  const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm';

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Ticket size={24} className="text-slate-500" /> Cupons de desconto
          </h1>
          <p className="mt-1 text-sm text-slate-500">Crie cupons e acompanhe o uso nas vendas.</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={15} /> Atualizar
        </button>
      </header>

      {/* Métricas topo */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Cupons ativos</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{coupons.filter((c) => c.active).length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Usos totais</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{totalRedemptions}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Desconto dado</div>
          <div className="mt-1 text-2xl font-bold text-emerald-600">{money(totalDiscount)}</div>
        </div>
      </div>

      {msg && (
        <div className={`mb-4 rounded-lg p-3 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {msg.text}
        </div>
      )}

      {/* Criar cupom */}
      <section className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          <Plus size={15} /> Novo cupom
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Código</label>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="LANCAMENTO20" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Nome (opcional)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Promo de lançamento" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Tipo</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setDiscountType('PERCENT')} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${discountType === 'PERCENT' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600'}`}>Percentual (%)</button>
              <button type="button" onClick={() => setDiscountType('FIXED')} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${discountType === 'FIXED' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600'}`}>Valor ($)</button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">{discountType === 'PERCENT' ? 'Percentual (1-100)' : 'Valor em USD'}</label>
            <input type="number" min="1" value={value} onChange={(e) => setValue(e.target.value)} placeholder={discountType === 'PERCENT' ? '20' : '10'} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Duração</label>
            <select value={duration} onChange={(e) => setDuration(e.target.value as typeof duration)} className={inputCls}>
              <option value="once">Só na 1ª cobrança</option>
              <option value="forever">Sempre</option>
              <option value="repeating">Por N meses</option>
            </select>
          </div>
          {duration === 'repeating' ? (
            <div>
              <label className="mb-1 block text-xs text-slate-500">Nº de meses</label>
              <input type="number" min="1" value={durationInMonths} onChange={(e) => setDurationInMonths(e.target.value)} className={inputCls} />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs text-slate-500">Limite de usos (opcional)</label>
              <input type="number" min="1" value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} placeholder="ilimitado" className={inputCls} />
            </div>
          )}
        </div>
        <button type="button" onClick={create} disabled={busy} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">
          {busy ? 'Criando…' : 'Criar cupom'}
        </button>
      </section>

      {/* Lista + métricas */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Cupons</h2>
        {loading ? (
          <div className="py-10 text-center text-slate-400">Carregando…</div>
        ) : coupons.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-slate-400">Nenhum cupom ainda.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 font-medium">Código</th>
                  <th className="px-4 py-2.5 font-medium">Desconto</th>
                  <th className="px-4 py-2.5 font-medium">Duração</th>
                  <th className="px-4 py-2.5 font-medium">Usos</th>
                  <th className="px-4 py-2.5 font-medium">Desconto dado</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <div className="font-mono font-medium text-slate-900">{c.code}</div>
                      {c.name ? <div className="text-[11px] text-slate-400">{c.name}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{discountLabel(c)}</td>
                    <td className="px-4 py-3 text-slate-500">{durationLabel(c)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {c.redemptionCount}
                      {c.maxRedemptions ? <span className="text-slate-400"> / {c.maxRedemptions}</span> : null}
                    </td>
                    <td className="px-4 py-3 font-medium text-emerald-600">{money(c.discountGivenCents)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${c.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {c.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
