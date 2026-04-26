'use client';

import { useState } from 'react';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  border: '1px solid var(--border2)',
  borderRadius: 8,
  fontSize: 14,
  fontFamily: 'var(--font-inter, "DM Sans"), sans-serif',
  outline: 'none',
  marginTop: 6,
  boxSizing: 'border-box',
  background: 'var(--sand)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--ink3)',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
};

export default function ContactForm() {
  const [form, setForm] = useState({
    nome: '',
    email: '',
    telefone: '',
    empresa: '',
    tipoContacto: 'pessoal' as 'pessoal' | 'empresa',
    mensagem: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const update = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setError(d.error || 'Erro');
        setLoading(false);
        return;
      }
      setSuccess(true);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div
        style={{
          background: 'var(--paper)',
          padding: 40,
          borderRadius: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
          textAlign: 'center',
          border: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            margin: '0 auto 20px',
            background: 'var(--green)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
            fontSize: 28,
            marginBottom: 8,
            color: 'var(--ink)',
            fontWeight: 600,
          }}
        >
          Mensagem enviada
        </h2>
        <p style={{ color: 'var(--ink2)', fontSize: 14 }}>
          Vamos contatar você em menos de 24h.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'var(--paper)',
        padding: 32,
        borderRadius: 12,
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        border: '1px solid var(--border)',
      }}
    >
      <h2
        style={{
          fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
          fontSize: 28,
          marginBottom: 20,
          color: 'var(--ink)',
          fontWeight: 600,
        }}
      >
        Envie-nos uma mensagem
      </h2>
      <form onSubmit={submit} noValidate>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Nome *</label>
          <input
            style={inputStyle}
            required
            value={form.nome}
            onChange={(e) => update('nome', e.target.value)}
            autoComplete="name"
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Email *</label>
          <input
            style={inputStyle}
            type="email"
            required
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            autoComplete="email"
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Telefone *</label>
          <input
            style={inputStyle}
            required
            value={form.telefone}
            onChange={(e) => update('telefone', e.target.value)}
            autoComplete="tel"
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <span style={labelStyle}>Sou contato</span>
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            <label
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}
            >
              <input
                type="radio"
                name="tipo"
                value="pessoal"
                checked={form.tipoContacto === 'pessoal'}
                onChange={() => update('tipoContacto', 'pessoal')}
              />{' '}
              Pessoal
            </label>
            <label
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}
            >
              <input
                type="radio"
                name="tipo"
                value="empresa"
                checked={form.tipoContacto === 'empresa'}
                onChange={() => update('tipoContacto', 'empresa')}
              />{' '}
              Empresa
            </label>
          </div>
        </div>
        {form.tipoContacto === 'empresa' && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Empresa *</label>
            <input
              style={inputStyle}
              required
              value={form.empresa}
              onChange={(e) => update('empresa', e.target.value)}
              autoComplete="organization"
            />
          </div>
        )}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Mensagem (opcional)</label>
          <textarea
            rows={4}
            style={{
              ...inputStyle,
              resize: 'vertical' as const,
            }}
            value={form.mensagem}
            onChange={(e) => update('mensagem', e.target.value)}
          />
        </div>
        {error ? (
          <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 14, textAlign: 'center' }}>{error}</p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: 14,
            background: loading ? '#a8865d' : 'var(--amber)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '0.5px',
            cursor: loading ? 'wait' : 'pointer',
            fontFamily: 'var(--font-inter, "DM Sans"), sans-serif',
            boxShadow: '0 2px 8px rgba(201,169,110,.25)',
          }}
        >
          {loading ? 'A enviar...' : 'Enviar mensagem'}
        </button>
      </form>
    </div>
  );
}
