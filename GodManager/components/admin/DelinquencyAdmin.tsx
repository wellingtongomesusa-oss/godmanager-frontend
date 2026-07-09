'use client';

import { useCallback, useMemo, useState } from 'react';
import { Mail, Upload, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';

type PreviewItem = {
  unit: string;
  csvName: string;
  amountReceivable: number;
  past0_30: number;
  past30plus: number;
  lastPayment: string;
  lateCount: number;
  matched: boolean;
  tenantId: string | null;
  tenantName: string | null;
  propertyId: string | null;
  propertyAddress: string | null;
  email: string | null;
  sendable: boolean;
};

type Summary = {
  total: number;
  matched: number;
  sendable: number;
  noMatch: number;
  noEmail: number;
  totalReceivable: number;
};

const money = (n: number) =>
  '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const DEFAULT_SUBJECT = 'Payment Reminder — Amount Due';
const DEFAULT_INTRO =
  'This is a friendly reminder that your account currently shows a balance due. Please find the details below.';

export function DelinquencyAdmin() {
  const { user } = useAuth();
  const [csv, setCsv] = useState('');
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [intro, setIntro] = useState(DEFAULT_INTRO);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const roleOk = !user || ['super_admin', 'admin', 'manager'].includes(String(user.role).toLowerCase());

  const analyze = useCallback(async () => {
    setMsg(null);
    setLoading(true);
    setItems([]);
    setSummary(null);
    try {
      const r = await fetch('/api/delinquency/preview', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setMsg({ ok: false, text: d.error || `Erro ${r.status}` });
        return;
      }
      setItems(d.items || []);
      setSummary(d.summary || null);
      const preSel: Record<string, boolean> = {};
      (d.items || []).forEach((it: PreviewItem) => {
        if (it.sendable && it.tenantId) preSel[it.tenantId] = true;
      });
      setSelected(preSel);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Falha' });
    } finally {
      setLoading(false);
    }
  }, [csv]);

  const onFile = useCallback((f: File | null) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result || ''));
    reader.readAsText(f);
  }, []);

  const selectedCount = useMemo(
    () => items.filter((i) => i.tenantId && selected[i.tenantId]).length,
    [items, selected],
  );

  const send = useCallback(async () => {
    const toSend = items.filter((i) => i.sendable && i.tenantId && selected[i.tenantId]);
    if (!toSend.length) {
      setMsg({ ok: false, text: 'Selecione ao menos um inquilino com e-mail.' });
      return;
    }
    if (!window.confirm(`Enviar cobrança para ${toSend.length} inquilino(s)?`)) return;
    setSending(true);
    setMsg(null);
    try {
      const r = await fetch('/api/delinquency/send', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          intro,
          items: toSend.map((i) => ({
            tenantId: i.tenantId,
            amountReceivable: i.amountReceivable,
            past0_30: i.past0_30,
            past30plus: i.past30plus,
          })),
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setMsg({ ok: false, text: d.error || `Erro ${r.status}` });
        return;
      }
      setMsg({
        ok: true,
        text: `${d.sent}/${d.total} e-mail(s) enviado(s) e registrado(s) no histórico da casa.`,
      });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Falha' });
    } finally {
      setSending(false);
    }
  }, [items, selected, subject, intro]);

  if (!roleOk) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center text-slate-500">
        Acesso restrito a administradores/gestores.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Mail className="h-6 w-6 text-[#22558c]" />
        <div>
          <h1 className="text-xl font-bold text-slate-800">Cobrança — Inquilinos em atraso</h1>
          <p className="text-sm text-slate-500">
            Suba o relatório <b>Delinquency</b> do AppFolio, confira a lista e envie. Todo e-mail é
            registrado automaticamente no histórico da casa e do inquilino.
          </p>
        </div>
      </div>

      {/* Passo 1 — CSV */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            <Upload className="h-4 w-4" />
            Escolher arquivo CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] || null)}
            />
          </label>
          <span className="text-xs text-slate-400">ou cole o conteúdo abaixo</span>
        </div>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder="Cole aqui o CSV do relatório Delinquency…"
          className="h-28 w-full resize-y rounded-lg border border-slate-200 p-3 font-mono text-xs text-slate-700 outline-none focus:border-[#22558c]"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={() => void analyze()}
            disabled={loading || !csv.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#22558c] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Analisar
          </button>
        </div>
      </div>

      {msg && (
        <div
          className={`mt-4 rounded-lg px-4 py-3 text-sm ${
            msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {msg.text}
        </div>
      )}

      {summary && (
        <>
          {/* Resumo */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ['Em atraso', String(summary.total), 'text-slate-800'],
              ['Prontos p/ envio', String(summary.sendable), 'text-green-600'],
              ['Sem e-mail', String(summary.noEmail), 'text-amber-600'],
              ['Sem correspondência', String(summary.noMatch), 'text-red-600'],
              ['Total a receber', money(summary.totalReceivable), 'text-[#22558c]'],
            ].map(([label, val, cls]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
                <div className={`mt-1 font-mono text-lg font-bold ${cls}`}>{val}</div>
              </div>
            ))}
          </div>

          {/* Mensagem editável */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 text-sm font-semibold text-slate-700">Mensagem</div>
            <label className="mb-1 block text-xs text-slate-500">Assunto</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mb-3 w-full rounded-lg border border-slate-200 p-2 text-sm outline-none focus:border-[#22558c]"
            />
            <label className="mb-1 block text-xs text-slate-500">Texto de abertura</label>
            <textarea
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              className="h-20 w-full resize-y rounded-lg border border-slate-200 p-2 text-sm outline-none focus:border-[#22558c]"
            />
            <p className="mt-2 text-xs text-slate-400">
              Os valores (total, 0–30, 30+) e o endereço da casa são preenchidos automaticamente por
              inquilino.
            </p>
          </div>

          {/* Tabela */}
          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <th className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedCount > 0 && selectedCount === summary.sendable}
                      onChange={(e) => {
                        const on = e.target.checked;
                        const next: Record<string, boolean> = {};
                        items.forEach((it) => {
                          if (it.sendable && it.tenantId) next[it.tenantId] = on;
                        });
                        setSelected(next);
                      }}
                    />
                  </th>
                  <th className="p-3">Unidade / Casa</th>
                  <th className="p-3">Inquilino</th>
                  <th className="p-3">E-mail</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-right">30+</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const key = it.tenantId || `nomatch-${idx}`;
                  return (
                    <tr key={key} className="border-b border-slate-100">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          disabled={!it.sendable}
                          checked={!!(it.tenantId && selected[it.tenantId])}
                          onChange={(e) =>
                            it.tenantId &&
                            setSelected((s) => ({ ...s, [it.tenantId as string]: e.target.checked }))
                          }
                        />
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-slate-800">{it.unit}</div>
                        {it.propertyAddress && (
                          <div className="text-xs text-slate-400">{it.propertyAddress}</div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="text-slate-700">{it.tenantName || it.csvName}</div>
                        {it.matched && it.tenantName && it.tenantName !== it.csvName && (
                          <div className="text-xs text-slate-400">CSV: {it.csvName}</div>
                        )}
                      </td>
                      <td className="p-3 text-slate-600">{it.email || '—'}</td>
                      <td className="p-3 text-right font-mono font-semibold text-slate-800">
                        {money(it.amountReceivable)}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-500">
                        {it.past30plus > 0 ? money(it.past30plus) : '—'}
                      </td>
                      <td className="p-3 text-center">
                        {it.sendable ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Pronto
                          </span>
                        ) : !it.matched ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                            <AlertTriangle className="h-3.5 w-3.5" /> Sem cadastro
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                            <AlertTriangle className="h-3.5 w-3.5" /> Sem e-mail
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex items-center justify-end gap-3">
            <span className="text-sm text-slate-500">{selectedCount} selecionado(s)</span>
            <button
              onClick={() => void send()}
              disabled={sending || selectedCount === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Enviar cobrança selecionada
            </button>
          </div>
        </>
      )}
    </div>
  );
}
