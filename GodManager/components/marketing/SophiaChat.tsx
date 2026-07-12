'use client';

import { useLocale } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

type Msg = { role: 'user' | 'assistant'; content: string };

const STR: Record<string, {
  title: string; subtitle: string; greeting: string; placeholder: string; send: string;
  open: string; close: string; chips: string[]; error: string; typing: string;
}> = {
  en: {
    title: 'SophIA', subtitle: 'GodManager assistant',
    greeting: "Hi! I'm SophIA. Ask me anything about GodManager or GODREALTOR — features, pricing, or how to get started.",
    placeholder: 'Type your question…', send: 'Send', open: 'Chat with SophIA', close: 'Close',
    chips: ['What is GodManager?', 'GODREALTOR plans', 'Request a demo'],
    error: 'Sorry, something went wrong. Please try again.', typing: 'SophIA is typing…',
  },
  'pt-br': {
    title: 'SophIA', subtitle: 'Assistente do GodManager',
    greeting: 'Oi! Sou a SophIA. Pergunte o que quiser sobre o GodManager ou o GODREALTOR — recursos, preços ou como começar.',
    placeholder: 'Digite sua pergunta…', send: 'Enviar', open: 'Falar com a SophIA', close: 'Fechar',
    chips: ['O que é o GodManager?', 'Planos GODREALTOR', 'Quero uma demo'],
    error: 'Desculpe, algo deu errado. Tente novamente.', typing: 'SophIA está digitando…',
  },
  es: {
    title: 'SophIA', subtitle: 'Asistente de GodManager',
    greeting: '¡Hola! Soy SophIA. Pregúntame lo que quieras sobre GodManager o GODREALTOR: funciones, precios o cómo empezar.',
    placeholder: 'Escribe tu pregunta…', send: 'Enviar', open: 'Chatear con SophIA', close: 'Cerrar',
    chips: ['¿Qué es GodManager?', 'Planes GODREALTOR', 'Solicitar una demo'],
    error: 'Lo sentimos, algo salió mal. Inténtalo de nuevo.', typing: 'SophIA está escribiendo…',
  },
};

export default function SophiaChat() {
  const locale = useLocale();
  const t = STR[locale] || STR.en;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const msgsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
  }, [messages, loading, open]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    const next = [...messages, { role: 'user' as const, content: q }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const r = await fetch('/api/ai/site-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, locale }),
      });
      const j = await r.json();
      const answer = j?.ok && j?.answer ? String(j.answer) : t.error;
      setMessages((m) => [...m, { role: 'assistant', content: answer }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: t.error }]);
    } finally {
      setLoading(false);
    }
  }

  const navy = '#1e2b3d';
  const cream = '#f5f2ec';

  return (
    <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 2147483000, fontFamily: "'Inter',system-ui,sans-serif" }}>
      {open && (
        <div
          style={{
            position: 'absolute', right: 0, bottom: 66, width: 'min(380px, calc(100vw - 32px))',
            height: 'min(560px, calc(100vh - 120px))', background: '#fff', borderRadius: 16,
            boxShadow: '0 18px 50px rgba(0,0,0,.22)', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', border: '1px solid #e6e2d9',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: navy, color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#c9a96e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, color: navy }}>S</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.1 }}>{t.title}</div>
                <div style={{ fontSize: 11, opacity: 0.75 }}>{t.subtitle}</div>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label={t.close}
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: '2px 6px' }}>×</button>
          </div>

          <div ref={msgsRef} style={{ flex: 1, overflowY: 'auto', padding: 14, background: cream, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Bubble role="assistant" text={t.greeting} navy={navy} />
            {messages.map((m, i) => <Bubble key={i} role={m.role} text={m.content} navy={navy} />)}
            {loading && <div style={{ fontSize: 11, color: '#8a8578', fontStyle: 'italic' }}>{t.typing}</div>}
          </div>

          {messages.length === 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 12px', background: cream, borderTop: '1px solid #e6e2d9' }}>
              {t.chips.map((c) => (
                <button key={c} type="button" onClick={() => send(c)}
                  style={{ padding: '5px 10px', border: '1px solid #d8d2c6', borderRadius: 14, background: '#fff', color: navy, fontSize: 11, cursor: 'pointer' }}>{c}</button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid #e6e2d9', background: '#fff', alignItems: 'flex-end' }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
              rows={1}
              placeholder={t.placeholder}
              style={{ flex: 1, resize: 'none', border: '1px solid #d8d2c6', borderRadius: 8, padding: '9px 11px', fontSize: 13, fontFamily: 'inherit', outline: 'none', maxHeight: 90 }}
            />
            <button type="button" onClick={() => send(input)} disabled={loading || !input.trim()}
              style={{ padding: '9px 15px', background: loading || !input.trim() ? '#b9b3a6' : '#c9a96e', color: navy, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: loading || !input.trim() ? 'default' : 'pointer' }}>{t.send}</button>
          </div>
        </div>
      )}

      <button type="button" onClick={() => setOpen((v) => !v)} aria-label={open ? t.close : t.open} title={open ? t.close : t.open}
        style={{ width: 56, height: 56, borderRadius: '50%', background: navy, border: 'none', boxShadow: '0 8px 22px rgba(0,0,0,.28)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {open ? (
          <span style={{ color: '#fff', fontSize: 24, lineHeight: 1 }}>×</span>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2z" /></svg>
        )}
      </button>
    </div>
  );
}

function Bubble({ role, text, navy }: { role: 'user' | 'assistant'; text: string; navy: string }) {
  const isUser = role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '82%', padding: '9px 12px', borderRadius: 12, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap',
        background: isUser ? navy : '#fff', color: isUser ? '#fff' : '#2a2a2a',
        border: isUser ? 'none' : '1px solid #e6e2d9', borderBottomRightRadius: isUser ? 3 : 12, borderBottomLeftRadius: isUser ? 12 : 3,
      }}>{text}</div>
    </div>
  );
}
