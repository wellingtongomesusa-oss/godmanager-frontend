'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, RefreshCw, Banknote, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';

type Link = {
  id: string;
  clientId: string;
  companyName: string | null;
  linkType: 'TENANT' | 'OWNER' | 'CLIENT';
  entityId: string;
  institutionName: string | null;
  accountMask: string | null;
  accountName: string | null;
};

type Transfer = {
  id: string;
  linkType: string;
  entityId: string;
  direction: 'DEBIT' | 'CREDIT';
  amount: string;
  description: string | null;
  status: string;
  failureReason: string | null;
  plaidTransferId: string | null;
  createdAt: string;
};

const money = (n: number | string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n) || 0);

function statusColor(s: string): string {
  const t = s.toLowerCase();
  if (['settled', 'funds_available', 'posted'].includes(t)) return 'bg-emerald-50 text-emerald-700';
  if (['failed', 'returned', 'cancelled'].includes(t)) return 'bg-rose-50 text-rose-700';
  return 'bg-amber-50 text-amber-700';
}

export function TransfersAdmin() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [env, setEnv] = useState('sandbox');
  const [links, setLinks] = useState<Link[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [linkId, setLinkId] = useState('');
  const [direction, setDirection] = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, led] = await Promise.all([
        fetch('/api/plaid/transfers/links', { credentials: 'include', cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/plaid/transfers', { credentials: 'include', cache: 'no-store' }).then((r) => r.json()),
      ]);
      if (cfg?.ok) {
        setEnabled(!!cfg.enabled);
        setEnv(cfg.env || 'sandbox');
        setLinks(cfg.links || []);
      }
      if (led?.ok) setTransfers(led.transfers || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  if (user && String(user.role).toLowerCase() !== 'super_admin') {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center text-slate-500">
        Acesso restrito ao super administrador da plataforma.
      </div>
    );
  }

  const submit = async () => {
    setMsg(null);
    const link = links.find((l) => l.id === linkId);
    if (!link) {
      setMsg({ kind: 'err', text: 'Selecione uma conta vinculada.' });
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setMsg({ kind: 'err', text: 'Informe um valor válido.' });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/plaid/transfers', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkType: link.linkType,
          entityId: link.entityId,
          direction,
          amount: amt,
          description: description.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setMsg({ kind: 'ok', text: `Transferência criada (status: ${data.transfer?.status}).` });
        setAmount('');
        setDescription('');
      } else {
        setMsg({ kind: 'err', text: data?.error || 'Falha ao criar transferência.' });
      }
      await loadAll();
    } finally {
      setBusy(false);
    }
  };

  const reconcile = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/plaid/transfers/reconcile', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setMsg({ kind: 'ok', text: `Reconciliado: ${data.updated}/${data.checked} atualizado(s).` });
      } else {
        setMsg({ kind: 'err', text: data?.error || 'Falha ao reconciliar.' });
      }
      await loadAll();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Banknote size={24} className="text-slate-500" /> Transferências ACH
          </h1>
          <p className="mt-1 text-sm text-slate-500">Débito e crédito nas contas dos clientes via Plaid Transfer.</p>
        </div>
        <button
          type="button"
          onClick={reconcile}
          disabled={busy || !enabled}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={15} /> Atualizar status
        </button>
      </header>

      <div
        className={`mb-6 flex items-center gap-2 rounded-lg p-3 text-sm ${
          enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
        }`}
      >
        <AlertTriangle size={16} />
        {enabled
          ? `Plaid Transfer ATIVO — ambiente: ${env}${env === 'production' ? ' (DINHEIRO REAL)' : ' (sandbox)'}.`
          : 'Plaid Transfer desligado. Defina PLAID_TRANSFER_ENABLED=true (após aprovação e testes em sandbox).'}
      </div>

      {msg && (
        <div
          className={`mb-4 rounded-lg p-3 text-sm ${
            msg.kind === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
          }`}
        >
          {msg.text}
        </div>
      )}

      <section className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Nova transferência</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-slate-500">Conta vinculada</label>
            <select
              value={linkId}
              onChange={(e) => setLinkId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">— Selecione a conta —</option>
              {links.map((l) => (
                <option key={l.id} value={l.id}>
                  {(l.companyName || l.clientId) + ' · ' + l.linkType + ' · ' + (l.institutionName || 'Banco') + ' ••••' + (l.accountMask || '')}
                </option>
              ))}
            </select>
            {links.length === 0 && (
              <p className="mt-1 text-[11px] text-slate-400">Nenhuma conta vinculada via Plaid ainda.</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Tipo</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDirection('DEBIT')}
                className={`flex flex-1 items-center justify-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                  direction === 'DEBIT' ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-600'
                }`}
              >
                <ArrowDownLeft size={15} /> Débito (puxar)
              </button>
              <button
                type="button"
                onClick={() => setDirection('CREDIT')}
                className={`flex flex-1 items-center justify-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                  direction === 'CREDIT' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600'
                }`}
              >
                <ArrowUpRight size={15} /> Crédito (enviar)
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Valor (USD)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-slate-500">Descrição (até 15 caracteres)</label>
            <input
              type="text"
              maxLength={15}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Aluguel Jul"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={submit}
            disabled={busy || !enabled}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {direction === 'DEBIT' ? 'Debitar da conta' : 'Creditar na conta'}
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Histórico (ledger)</h2>
        {loading ? (
          <div className="py-10 text-center text-slate-400">Carregando…</div>
        ) : transfers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-slate-400">
            Nenhuma transferência ainda.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 font-medium">Data</th>
                  <th className="px-4 py-2.5 font-medium">Tipo</th>
                  <th className="px-4 py-2.5 font-medium">Valor</th>
                  <th className="px-4 py-2.5 font-medium">Entidade</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-500">{new Date(t.createdAt).toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 ${
                          t.direction === 'DEBIT' ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {t.direction === 'DEBIT' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                        {t.direction === 'DEBIT' ? 'Débito' : 'Crédito'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{money(t.amount)}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {t.linkType} · {t.entityId.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${statusColor(t.status)}`}>
                        {t.status}
                      </span>
                      {t.failureReason && (
                        <span className="ml-2 text-[11px] text-rose-500" title={t.failureReason}>
                          {t.failureReason.slice(0, 24)}
                        </span>
                      )}
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
