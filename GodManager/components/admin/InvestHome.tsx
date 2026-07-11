'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, DownloadCloud } from 'lucide-react';
import {
  computeInvestMetrics,
  type InvestAssumptions,
  DEFAULT_ASSUMPTIONS,
} from '@/lib/investCalc';

type House = {
  propertyId: string;
  address: string;
  community: string;
  bedrooms: number | null;
  reservasTotal: number;
  payoutsTotal: number;
  ownerTotal: number;
  monthsWithData: number;
  value: number;
  valueSource: string | null;
  valueUpdatedAt: string | null;
};
type Fx = { rate: number | null; source: string; at: string | null };

const SIZE_BANDS = [
  { key: 'all', label: 'Todos os tamanhos', test: () => true },
  { key: '1-3', label: '1–3 quartos', test: (b: number) => b >= 1 && b <= 3 },
  { key: '4-5', label: '4–5 quartos', test: (b: number) => b >= 4 && b <= 5 },
  { key: '6-8', label: '6–8 quartos', test: (b: number) => b >= 6 && b <= 8 },
  { key: '9+', label: '9+ quartos', test: (b: number) => b >= 9 },
];

function clientIdFromUrl(): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('clientId') || '';
}

export function InvestHome() {
  const [houses, setHouses] = useState<House[]>([]);
  const [assumptions, setAssumptions] = useState<InvestAssumptions>({ ...DEFAULT_ASSUMPTIONS });
  const [fx, setFx] = useState<Fx>({ rate: null, source: '', at: null });
  const [rentcastOk, setRentcastOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [currency, setCurrency] = useState<'USD' | 'BRL'>('USD');
  const [fCommunity, setFCommunity] = useState('all');
  const [fSize, setFSize] = useState('all');
  const [sortBy, setSortBy] = useState<'roic' | 'roi' | 'cashflow' | 'noi' | 'dscr'>('roic');
  const [pulling, setPulling] = useState(false);
  const clientId = useMemo(clientIdFromUrl, []);
  const q = clientId ? `?clientId=${encodeURIComponent(clientId)}` : '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/invest/dashboard' + q, { credentials: 'include', cache: 'no-store' });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setMsg({ ok: false, text: d.error || `Erro ${r.status}` });
        return;
      }
      setHouses(d.houses || []);
      setAssumptions(d.assumptions || { ...DEFAULT_ASSUMPTIONS });
      setFx(d.fx || { rate: null, source: '', at: null });
      setRentcastOk(!!d.rentcastConfigured);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Falha' });
    } finally {
      setLoading(false);
    }
  }, [q]);
  useEffect(() => {
    void load();
  }, [load]);

  const rate = fx.rate || 1;
  const money = useCallback(
    (usd: number | null) => {
      if (usd == null) return '—';
      const v = currency === 'BRL' ? usd * rate : usd;
      const sym = currency === 'BRL' ? 'R$' : '$';
      return sym + v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    },
    [currency, rate],
  );
  const pct = (x: number | null) => (x == null ? '—' : (x * 100).toFixed(1) + '%');
  const num = (x: number | null, d = 2) => (x == null ? '—' : x.toFixed(d));

  // Métricas por casa (client-side).
  const rows = useMemo(
    () =>
      houses.map((h) => ({
        h,
        m: computeInvestMetrics(
          {
            value: h.value,
            reservasTotal: h.reservasTotal,
            ownerTotal: h.ownerTotal,
            payoutsTotal: h.payoutsTotal,
            monthsWithData: h.monthsWithData,
          },
          assumptions,
        ),
      })),
    [houses, assumptions],
  );

  const communities = useMemo(
    () => [...new Set(houses.map((h) => h.community).filter(Boolean))].sort(),
    [houses],
  );

  const filtered = useMemo(() => {
    const band = SIZE_BANDS.find((b) => b.key === fSize) || SIZE_BANDS[0];
    const out = rows.filter(
      (r) =>
        (fCommunity === 'all' || r.h.community === fCommunity) &&
        (fSize === 'all' || (r.h.bedrooms != null && band.test(r.h.bedrooms))),
    );
    const key = (r: (typeof rows)[0]) => {
      const m = r.m;
      if (sortBy === 'roi') return m.capRate ?? -1e9;
      if (sortBy === 'cashflow') return m.cashFlowAnnual ?? -1e9;
      if (sortBy === 'noi') return m.noi ?? -1e9;
      if (sortBy === 'dscr') return m.dscr ?? -1e9;
      return m.cashOnCash ?? -1e9; // roic
    };
    return [...out].sort((a, b) => key(b) - key(a));
  }, [rows, fCommunity, fSize, sortBy]);

  const kpis = useMemo(() => {
    const withVal = filtered.filter((r) => r.m.hasValue);
    const avg = (arr: (number | null)[]) => {
      const v = arr.filter((x): x is number => x != null);
      return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
    };
    return {
      withValue: withVal.length,
      communities: new Set(filtered.map((r) => r.h.community)).size,
      capRate: avg(withVal.map((r) => r.m.capRate)),
      coc: avg(withVal.map((r) => r.m.cashOnCash)),
      dscr: avg(withVal.map((r) => r.m.dscr)),
      portfolioCashFlow: withVal.reduce((s, r) => s + (r.m.cashFlowAnnual || 0), 0),
    };
  }, [filtered]);

  const byCommunity = useMemo(() => {
    const map = new Map<string, { houses: number; beds: number; value: number; caps: number[] }>();
    for (const r of filtered) {
      const c = r.h.community || '—';
      const e = map.get(c) || { houses: 0, beds: 0, value: 0, caps: [] };
      e.houses++;
      e.beds += r.h.bedrooms || 0;
      e.value += r.h.value || 0;
      if (r.m.capRate != null) e.caps.push(r.m.capRate);
      map.set(c, e);
    }
    return [...map.entries()]
      .map(([community, e]) => ({
        community,
        houses: e.houses,
        beds: e.beds,
        value: e.value,
        capAvg: e.caps.length ? e.caps.reduce((s, x) => s + x, 0) / e.caps.length : null,
      }))
      .sort((a, b) => (b.capAvg ?? -1) - (a.capAvg ?? -1));
  }, [filtered]);
  const maxCap = Math.max(0.0001, ...byCommunity.map((c) => c.capAvg || 0));

  const saveValue = useCallback(
    async (propertyId: string, value: number) => {
      setHouses((hs) =>
        hs.map((h) =>
          h.propertyId === propertyId
            ? { ...h, value, valueSource: 'manual', valueUpdatedAt: new Date().toISOString() }
            : h,
        ),
      );
      await fetch('/api/invest/value', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, value, clientId: clientId || undefined }),
      }).catch(() => {});
    },
    [clientId],
  );

  const saveAssumptions = useCallback(async () => {
    setMsg(null);
    const r = await fetch('/api/invest/assumptions', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...assumptions, clientId: clientId || undefined }),
    });
    const d = await r.json().catch(() => ({}));
    setMsg(d.ok ? { ok: true, text: 'Premissas salvas.' } : { ok: false, text: d.error || 'Erro' });
  }, [assumptions, clientId]);

  const pull = useCallback(async () => {
    if (!rentcastOk) {
      setMsg({ ok: false, text: 'Falta configurar RENTCAST_API_KEY (variável de ambiente).' });
      return;
    }
    setPulling(true);
    setMsg(null);
    try {
      const r = await fetch('/api/invest/pull-values', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: clientId || undefined }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setMsg({ ok: false, text: d.error || `Erro ${r.status}` });
        return;
      }
      setMsg({
        ok: true,
        text: `${d.pulled} valor(es) puxado(s) em ${d.calls} chamada(s).${d.stoppedRateLimit ? ' Parou no limite (429).' : ''}`,
      });
      await load();
    } finally {
      setPulling(false);
    }
  }, [rentcastOk, clientId, load]);

  const th = (label: string, tip: string, extra = '') => (
    <th
      title={tip}
      className={`px-2 py-2 text-[11px] font-semibold uppercase text-slate-500 ${extra}`}
      style={{ cursor: 'help', textDecoration: 'underline dotted' }}
    >
      {label}
    </th>
  );

  if (loading) {
    return <div className="p-10 text-center text-slate-400">Carregando Invest Home…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-[1360px] px-6 py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Invest Home</h1>
          <p className="text-xs text-slate-500">
            Rentabilidade por casa (financiamento + câmbio). Receita = owner recebido líquido (aprox. — não deduz
            imposto/HOA/seguro).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[11px] text-slate-400">
            USD→BRL {fx.rate ? fx.rate.toFixed(4) : '—'} · {fx.source}
          </div>
          <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 text-xs font-semibold">
            <button
              onClick={() => setCurrency('USD')}
              className={`px-3 py-1.5 ${currency === 'USD' ? 'bg-[#22558c] text-white' : 'bg-white text-slate-600'}`}
            >
              US$
            </button>
            <button
              onClick={() => setCurrency('BRL')}
              className={`px-3 py-1.5 ${currency === 'BRL' ? 'bg-[#22558c] text-white' : 'bg-white text-slate-600'}`}
            >
              R$
            </button>
          </div>
          <button
            onClick={() => void pull()}
            disabled={pulling}
            title={rentcastOk ? 'Puxar valores do Rentcast (prioriza maior receita)' : 'Falta RENTCAST_API_KEY'}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {pulling ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <DownloadCloud className="h-3.5 w-3.5" />}
            Puxar valores
          </button>
        </div>
      </div>

      {msg && (
        <div className={`mb-3 rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      {/* Premissas */}
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3">
        {[
          ['Entrada %', 'downPct'],
          ['Juros a.a. %', 'rate'],
          ['OpEx %', 'opexPct'],
        ].map(([label, key]) => (
          <label key={key} className="text-[11px] text-slate-500">
            {label}
            <input
              type="number"
              step="0.5"
              value={Math.round((assumptions[key as 'downPct'] as number) * 1000) / 10}
              onChange={(e) =>
                setAssumptions((a) => ({ ...a, [key]: (Number(e.target.value) || 0) / 100 }))
              }
              className="mt-1 block w-20 rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </label>
        ))}
        <label className="text-[11px] text-slate-500">
          Prazo (anos)
          <input
            type="number"
            value={assumptions.termYears}
            onChange={(e) => setAssumptions((a) => ({ ...a, termYears: Number(e.target.value) || 30 }))}
            className="mt-1 block w-20 rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-[11px] text-slate-500">
          Base receita
          <select
            value={assumptions.revenueBasis}
            onChange={(e) => setAssumptions((a) => ({ ...a, revenueBasis: e.target.value as InvestAssumptions['revenueBasis'] }))}
            className="mt-1 block rounded border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="gross">Gross (reservas+owner)</option>
            <option value="owner">Owner</option>
            <option value="payouts">Payouts</option>
          </select>
        </label>
        <button onClick={() => void saveAssumptions()} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white">
          Salvar premissas
        </button>
      </div>

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['Casas c/ valor', String(kpis.withValue)],
          ['Condomínios', String(kpis.communities)],
          ['Cap rate médio', pct(kpis.capRate)],
          ['Cash-on-cash médio', pct(kpis.coc)],
          ['DSCR médio', num(kpis.dscr)],
          ['Fluxo do portfólio', money(kpis.portfolioCashFlow)],
        ].map(([l, v]) => (
          <div key={l} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-[10px] uppercase text-slate-400">{l}</div>
            <div className="mt-1 font-mono text-base font-bold text-slate-800">{v}</div>
          </div>
        ))}
      </div>

      {/* Por condomínio */}
      {byCommunity.length > 0 && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 text-xs font-semibold uppercase text-slate-500">Cap rate médio por condomínio</div>
          <div className="space-y-1.5">
            {byCommunity.slice(0, 12).map((c) => (
              <div key={c.community} className="flex items-center gap-2 text-xs">
                <div className="w-40 shrink-0 truncate text-slate-600" title={c.community}>
                  {c.community} <span className="text-slate-400">({c.houses})</span>
                </div>
                <div className="h-3 flex-1 rounded bg-slate-100">
                  <div
                    className="h-3 rounded bg-[#2a6e4e]"
                    style={{ width: `${Math.round(((c.capAvg || 0) / maxCap) * 100)}%` }}
                  />
                </div>
                <div className="w-14 shrink-0 text-right font-mono text-slate-700">{pct(c.capAvg)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select value={fCommunity} onChange={(e) => setFCommunity(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-xs">
          <option value="all">Todos os condomínios</option>
          {communities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={fSize} onChange={(e) => setFSize(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-xs">
          {SIZE_BANDS.map((b) => (
            <option key={b.key} value={b.key}>
              {b.label}
            </option>
          ))}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="rounded border border-slate-300 px-2 py-1.5 text-xs">
          <option value="roic">Ordenar: Cash-on-cash (ROIC)</option>
          <option value="roi">Ordenar: Cap rate (ROI)</option>
          <option value="cashflow">Ordenar: Fluxo/ano</option>
          <option value="noi">Ordenar: NOI/ano</option>
          <option value="dscr">Ordenar: DSCR</option>
        </select>
        <span className="text-xs text-slate-400">{filtered.length} casas</span>
      </div>

      {/* Ranking */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              {th('#', 'Posição no ranking (pela ordenação escolhida)')}
              {th('Casa', 'Endereço da propriedade', 'text-left normal-case')}
              {th('Qtos', 'Quartos (tamanho)')}
              {th('Community', 'Condomínio/cidade (extraído do endereço)')}
              {th('Valor imóvel', 'Valor de mercado (editável). ✎ manual vence ● mercado (Rentcast)', 'text-right')}
              {th('Receita/ano', '(soma da base no período) × 12 ÷ nº de meses com dados', 'text-right')}
              {th('NOI/ano', 'Receita − OpEx (OpEx = receita × opex%)', 'text-right')}
              {th('Parcela/mês', 'Price: loan×r/(1−(1+r)^−n), r=juros/12, n=anos×12', 'text-right')}
              {th('Fluxo/ano', 'NOI − serviço da dívida anual', 'text-right')}
              {th('Cap rate', 'ROI sem alavancagem = NOI ÷ valor', 'text-right')}
              {th('Cash-on-cash', 'ROIC = (NOI − serviço da dívida) ÷ entrada', 'text-right')}
              {th('DSCR', 'NOI ÷ serviço da dívida (>1 = a casa paga o financiamento)', 'text-right')}
              {th('Payback', 'entrada ÷ fluxo de caixa anual (anos)', 'text-right')}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.h.propertyId} className={`border-b border-slate-100 ${i % 2 ? 'bg-slate-50/40' : ''}`}>
                <td className="px-2 py-2 text-slate-400">{i + 1}</td>
                <td className="max-w-[220px] truncate px-2 py-2 text-slate-800" title={r.h.address}>
                  {r.h.address}
                </td>
                <td className="px-2 py-2 text-center text-slate-600">{r.h.bedrooms ?? '—'}</td>
                <td className="px-2 py-2 text-slate-600">{r.h.community}</td>
                <td className="px-2 py-2 text-right">
                  <span className="mr-1 text-[10px]" title={r.h.valueSource === 'rentcast' ? 'valor de mercado (Rentcast)' : 'valor manual'}>
                    {r.h.value > 0 ? (r.h.valueSource === 'rentcast' ? '●' : '✎') : ''}
                  </span>
                  <input
                    type="number"
                    defaultValue={r.h.value || ''}
                    onBlur={(e) => {
                      const v = Number(e.target.value) || 0;
                      if (v !== r.h.value) void saveValue(r.h.propertyId, v);
                    }}
                    className="w-24 rounded border border-slate-200 px-1 py-0.5 text-right font-mono text-xs"
                    placeholder="$"
                  />
                </td>
                <td className="px-2 py-2 text-right font-mono text-slate-700">{money(r.m.revenueAnnual)}</td>
                <td className="px-2 py-2 text-right font-mono text-slate-700">{money(r.m.noi)}</td>
                <td className="px-2 py-2 text-right font-mono text-slate-700">{money(r.m.monthlyPayment)}</td>
                <td className={`px-2 py-2 text-right font-mono ${(r.m.cashFlowAnnual ?? 0) < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                  {money(r.m.cashFlowAnnual)}
                </td>
                <td className="px-2 py-2 text-right font-mono text-slate-700">{pct(r.m.capRate)}</td>
                <td className={`px-2 py-2 text-right font-mono font-semibold ${(r.m.cashOnCash ?? 0) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                  {pct(r.m.cashOnCash)}
                </td>
                <td className="px-2 py-2 text-right font-mono text-slate-700">{num(r.m.dscr)}</td>
                <td className="px-2 py-2 text-right font-mono text-slate-700">
                  {r.m.paybackYears != null ? r.m.paybackYears.toFixed(1) + 'a' : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-slate-400">
        Honestidade dos dados: “Reservas” e “Payouts por casa” não existem neste sistema (long-term). “Owner” = aluguel
        recebido líquido do mgmt fee. Percentuais são iguais em US$/R$ (são razões). Valores em BRL usam o câmbio {fx.rate ? fx.rate.toFixed(4) : '—'}.
      </p>
    </div>
  );
}
