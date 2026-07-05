'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Portal do inquilino: abrir chamado de manutenção + acompanhar os próprios chamados.
 * Abrir → POST /api/support-tickets (backend cria job PENDING na fila).
 * Listar → GET /api/support-tickets (já escopado ao requesterId do inquilino).
 */

type Ticket = {
  id: string;
  code: string;
  subject: string;
  status: string;
  createdAt: string;
  rating: number | null;
};

const STATUS_LABEL: Record<string, string> = {
  open: 'Aberto',
  answered: 'Respondido',
  in_progress: 'Em andamento',
  resolved: 'Resolvido',
  closed: 'Fechado',
};

function statusClasses(s: string): string {
  const t = s.toLowerCase();
  if (t === 'resolved' || t === 'closed') return 'bg-gm-green/15 text-gm-green';
  return 'bg-gm-amber/15 text-gm-amber';
}

export default function OpenTicketCard() {
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/support-tickets', { credentials: 'include', cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (data?.ok) setTickets(Array.isArray(data.tickets) ? data.tickets : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    const body = msg.trim();
    if (!body) return;
    setSending(true);
    setResult(null);
    try {
      const subject = body.length > 60 ? body.slice(0, 60) : body;
      const res = await fetch('/api/support-tickets', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        const code = String(data.ticket?.code || '');
        const job = data.linkedJobNumber;
        setResult({
          ok: true,
          text:
            `Chamado ${code} aberto!` +
            (job != null ? ` Já entrou na fila de manutenção (ordem de serviço #${job}).` : '') +
            ' Nossa equipe vai cuidar disso.',
        });
        setMsg('');
        await load();
      } else {
        setResult({
          ok: false,
          text: data?.error || 'Não foi possível abrir o chamado agora. Tente novamente.',
        });
      }
    } catch {
      setResult({ ok: false, text: 'Erro de conexão. Tente novamente.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="rounded-lg border border-gm-border bg-gm-paper p-6 shadow-sm">
        <h2 className="font-heading text-lg font-semibold text-gm-ink">Precisa de manutenção?</h2>
        <p className="mt-1 text-sm text-gm-ink-secondary">
          Descreva o problema no seu imóvel. Abrimos um chamado e nossa equipe cuida.
        </p>
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          rows={4}
          placeholder="Ex.: A torneira da cozinha está vazando…"
          className="mt-4 w-full rounded-lg border border-gm-border bg-gm-cream px-4 py-3 text-sm text-gm-ink"
        />
        {result ? (
          <div
            className={`mt-3 rounded-lg p-3 text-sm ${
              result.ok ? 'bg-gm-green/15 text-gm-green' : 'bg-gm-red/15 text-gm-red'
            }`}
          >
            {result.text}
          </div>
        ) : null}
        <button
          type="button"
          onClick={submit}
          disabled={sending || !msg.trim()}
          className="mt-4 rounded-lg bg-gm-ink px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
        >
          {sending ? 'Enviando…' : 'Abrir chamado'}
        </button>
      </div>

      <div className="mt-6 rounded-lg border border-gm-border bg-gm-paper p-6 shadow-sm">
        <h2 className="font-heading text-lg font-semibold text-gm-ink">Meus chamados</h2>
        {loading ? (
          <p className="mt-3 text-sm text-gm-ink-secondary">Carregando…</p>
        ) : tickets.length === 0 ? (
          <p className="mt-3 text-sm text-gm-ink-secondary">Você ainda não abriu nenhum chamado.</p>
        ) : (
          <ul className="mt-4 divide-y divide-gm-border">
            {tickets.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gm-ink">
                    <span className="font-mono text-xs text-gm-ink-secondary">{t.code}</span> · {t.subject}
                  </p>
                  <p className="text-[11px] text-gm-ink-secondary">
                    {new Date(t.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold ${statusClasses(t.status)}`}
                >
                  {STATUS_LABEL[t.status.toLowerCase()] ?? t.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
