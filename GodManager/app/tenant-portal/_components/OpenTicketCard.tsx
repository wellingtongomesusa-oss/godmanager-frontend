'use client';

import { useState } from 'react';

/**
 * Card do portal do inquilino para abrir um chamado de manutenção.
 * POST /api/support-tickets → o backend cria um job PENDING na fila (role=tenant).
 */
export default function OpenTicketCard() {
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

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
  );
}
