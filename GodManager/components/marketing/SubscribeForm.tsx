'use client';

import { useMemo, useState } from 'react';
import { calculatePrice } from '@/lib/billingPricing';
import type { BusinessSegment } from '@prisma/client';

const SEGMENTS: { value: BusinessSegment; label: string }[] = [
  { value: 'LONG_TERM', label: 'Long-term / Property Mgmt' },
  { value: 'SHORT_TERM', label: 'Short-term' },
  { value: 'HOSPITALITY', label: 'Hospitality' },
  { value: 'REALTOR', label: 'Realtor' },
  { value: 'INSURANCE', label: 'Insurance' },
];

export interface SubscribeInitial {
  segment?: BusinessSegment;
  packageTier?: number;
  avgRent?: number;
  avgVgv?: number;
  unitCount?: number;
  interval?: 'MONTHLY' | 'ANNUAL';
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

export default function SubscribeForm({ initial }: { initial?: SubscribeInitial }) {
  const [segment, setSegment] = useState<BusinessSegment>(initial?.segment ?? 'LONG_TERM');
  const [packageTier, setPackageTier] = useState<number>(initial?.packageTier ?? 1);
  const [avgRent, setAvgRent] = useState<number>(initial?.avgRent ?? 1800);
  const [avgVgv, setAvgVgv] = useState<number>(initial?.avgVgv ?? 500000);
  const [unitCount, setUnitCount] = useState<number>(initial?.unitCount ?? 1);
  const [interval, setInterval] = useState<'MONTHLY' | 'ANNUAL'>(initial?.interval ?? 'MONTHLY');

  const [companyName, setCompanyName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isLong = segment === 'LONG_TERM';
  const isPerUnit = segment === 'SHORT_TERM' || segment === 'HOSPITALITY';
  const isVgv = segment === 'REALTOR' || segment === 'INSURANCE';

  const pricing = useMemo(() => {
    const res = calculatePrice({
      segment,
      packageTier: isLong ? packageTier : null,
      avgRent: isLong ? avgRent : null,
      avgVgv: isVgv ? avgVgv : null,
      unitCount: isVgv ? 1 : unitCount,
    });
    return res.ok ? res : null;
  }, [segment, packageTier, avgRent, avgVgv, unitCount, isLong, isVgv]);

  const monthly = pricing ? pricing.monthlyTotalDisplay : 0;
  const annual = pricing ? pricing.annualTotalDisplay : 0;
  const shown = interval === 'ANNUAL' ? annual : monthly;

  async function submit() {
    setError('');
    if (!companyName.trim() || !firstName.trim() || !email.trim()) {
      setError('Preencha empresa, nome e e-mail.');
      return;
    }
    if (password.length < 8) {
      setError('A senha precisa ter ao menos 8 caracteres.');
      return;
    }
    if (!pricing) {
      setError('Configuração de plano inválida.');
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch('/api/billing/signup-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          password,
          segment,
          packageTier: isLong ? packageTier : null,
          avgRent: isLong ? avgRent : null,
          avgVgv: isVgv ? avgVgv : null,
          unitCount: isVgv ? 1 : unitCount,
          interval,
        }),
      });
      const data = await resp.json().catch(() => null);
      if (resp.ok && data?.ok && data.url) {
        window.location.href = data.url; // vai para o Stripe Checkout
        return;
      }
      setError(
        data?.error === 'Email ja existe.'
          ? 'Esse e-mail já tem conta. Faça login.'
          : data?.error === 'stripe_not_configured'
            ? 'Pagamentos ainda não configurados. Tente mais tarde.'
            : data?.error || 'Não foi possível iniciar o checkout.',
      );
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-[#1e2b3d] outline-none focus:border-[#c9a961]';

  return (
    <div className="min-h-screen bg-[#f5f0e8] px-6 py-12">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-2">
        {/* Plano + preço */}
        <div className="rounded-2xl border border-slate-200/60 bg-white p-8 shadow-sm">
          <h2 className="font-playfair text-2xl text-[#1e2b3d]">Seu plano</h2>
          <p className="mt-1 text-sm text-slate-500">Ajuste e veja o preço em tempo real.</p>

          <label className="mt-6 block text-xs font-semibold uppercase tracking-wide text-slate-500">Segmento</label>
          <select value={segment} onChange={(e) => setSegment(e.target.value as BusinessSegment)} className={`${inputCls} mt-1`}>
            {SEGMENTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {isLong && (
            <>
              <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">Pacote</label>
              <div className="mt-1 flex gap-2">
                {[1, 2, 3].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPackageTier(t)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                      packageTier === t ? 'border-[#c9a961] bg-[#c9a961]/10 text-[#1e2b3d]' : 'border-slate-300 text-slate-600'
                    }`}
                  >
                    P{t}
                  </button>
                ))}
              </div>
              <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">Aluguel médio (USD)</label>
              <input type="number" min={0} value={avgRent} onChange={(e) => setAvgRent(Number(e.target.value))} className={`${inputCls} mt-1`} />
            </>
          )}

          {(isLong || isPerUnit) && (
            <>
              <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">Nº de imóveis</label>
              <input type="number" min={1} value={unitCount} onChange={(e) => setUnitCount(Math.max(1, Number(e.target.value)))} className={`${inputCls} mt-1`} />
            </>
          )}

          {isVgv && (
            <>
              <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">VGV médio (USD)</label>
              <input type="number" min={0} value={avgVgv} onChange={(e) => setAvgVgv(Number(e.target.value))} className={`${inputCls} mt-1`} />
            </>
          )}

          <div className="mt-5 flex gap-2">
            {(['MONTHLY', 'ANNUAL'] as const).map((iv) => (
              <button
                key={iv}
                type="button"
                onClick={() => setInterval(iv)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                  interval === iv ? 'border-[#c9a961] bg-[#c9a961]/10 text-[#1e2b3d]' : 'border-slate-300 text-slate-600'
                }`}
              >
                {iv === 'MONTHLY' ? 'Mensal' : 'Anual (2 meses grátis)'}
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-xl bg-[#1e2b3d] p-5 text-white">
            <div className="text-xs uppercase tracking-wide text-white/60">Total {interval === 'ANNUAL' ? 'por ano' : 'por mês'}</div>
            <div className="mt-1 text-3xl font-semibold">{fmt(shown)}</div>
          </div>
        </div>

        {/* Cadastro */}
        <div className="rounded-2xl border border-slate-200/60 bg-white p-8 shadow-sm">
          <h2 className="font-playfair text-2xl text-[#1e2b3d]">Criar conta e assinar</h2>
          <p className="mt-1 text-sm text-slate-500">Você paga no Stripe e sua conta é ativada na hora.</p>

          <label className="mt-6 block text-xs font-semibold uppercase tracking-wide text-slate-500">Empresa</label>
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={`${inputCls} mt-1`} placeholder="Sua empresa LLC" />

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Nome</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={`${inputCls} mt-1`} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Sobrenome</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={`${inputCls} mt-1`} />
            </div>
          </div>

          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">E-mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputCls} mt-1`} placeholder="voce@empresa.com" />

          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">Senha (mín. 8)</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputCls} mt-1`} />

          {error ? <div className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}

          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-[#c9a961] px-4 py-3 text-sm font-semibold text-[#1e2b3d] transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Redirecionando ao Stripe…' : `Assinar por ${fmt(shown)}/${interval === 'ANNUAL' ? 'ano' : 'mês'}`}
          </button>
          <p className="mt-3 text-center text-xs text-slate-400">Pagamento seguro via Stripe. Cancele quando quiser.</p>
        </div>
      </div>
    </div>
  );
}
