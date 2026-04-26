'use client';

import { useState } from 'react';

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(15,23,42,0.8)',
  border: '1px solid rgba(201,169,110,0.3)',
  color: '#fff',
  padding: '12px 14px',
  borderRadius: 7,
  fontFamily: 'inherit',
  fontSize: 13,
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: '#c9a96e',
  fontSize: 10,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  marginBottom: 6,
  fontWeight: 600,
};

interface FormState {
  nome: string;
  empresa: string;
  email: string;
  telefone: string;
  redeSocial: string;
  siteEmpresa: string;
}

const empty: FormState = {
  nome: '',
  empresa: '',
  email: '',
  telefone: '',
  redeSocial: '',
  siteEmpresa: '',
};

export function RequestDemoForm() {
  const [form, setForm] = useState<FormState>(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/request-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.redirectTo) {
        setError(data?.error || 'Erro ao processar pedido.');
        setLoading(false);
        return;
      }
      window.location.href = String(data.redirectTo);
    } catch (err) {
      console.error(err);
      setError('Erro de rede. Tente novamente.');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <h2
        style={{
          fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
          fontSize: 22,
          fontWeight: 600,
          marginBottom: 4,
          color: '#fff',
        }}
      >
        Os seus dados
      </h2>
      <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 20 }}>
        Preencha para receber acesso imediato.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>Nome *</label>
          <input
            required
            style={inputStyle}
            value={form.nome}
            onChange={(e) => update('nome', e.target.value)}
            placeholder="O seu nome"
            autoComplete="name"
          />
        </div>
        <div>
          <label style={labelStyle}>Empresa *</label>
          <input
            required
            style={inputStyle}
            value={form.empresa}
            onChange={(e) => update('empresa', e.target.value)}
            placeholder="Nome da empresa"
            autoComplete="organization"
          />
        </div>
        <div>
          <label style={labelStyle}>Email *</label>
          <input
            required
            type="email"
            style={inputStyle}
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
          />
        </div>
        <div>
          <label style={labelStyle}>Telefone *</label>
          <input
            required
            style={inputStyle}
            value={form.telefone}
            onChange={(e) => update('telefone', e.target.value)}
            placeholder="+1 (407) 000-0000"
            autoComplete="tel"
          />
        </div>
        <div>
          <label style={labelStyle}>Rede social</label>
          <input
            style={inputStyle}
            value={form.redeSocial}
            onChange={(e) => update('redeSocial', e.target.value)}
            placeholder="LinkedIn, Instagram, etc. (opcional)"
          />
        </div>
        <div>
          <label style={labelStyle}>Site da empresa</label>
          <input
            style={inputStyle}
            value={form.siteEmpresa}
            onChange={(e) => update('siteEmpresa', e.target.value)}
            placeholder="https://exemplo.com (opcional)"
          />
        </div>
      </div>

      {error ? (
        <div
          style={{
            marginTop: 18,
            padding: 12,
            border: '1px solid rgba(220,38,38,0.4)',
            background: 'rgba(220,38,38,0.1)',
            color: '#fca5a5',
            fontSize: 12,
            borderRadius: 6,
          }}
        >
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        style={{
          marginTop: 22,
          width: '100%',
          background: '#c9a96e',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '14px 20px',
          fontFamily: 'inherit',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.5px',
          cursor: loading ? 'wait' : 'pointer',
          opacity: loading ? 0.6 : 1,
          boxShadow: '0 2px 8px rgba(201,169,110,0.25)',
        }}
      >
        {loading ? 'A processar...' : 'Aceder ao Demo'}
      </button>

      <p style={{ marginTop: 14, color: '#64748b', fontSize: 11, textAlign: 'center' }}>
        Acesso imediato. Sem cartao de credito.
      </p>
    </form>
  );
}
