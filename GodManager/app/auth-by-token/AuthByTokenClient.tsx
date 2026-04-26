'use client';

import { useEffect, useState } from 'react';

type Status = 'idle' | 'loading' | 'ok' | 'error';

export function AuthByTokenClient({ token }: { token: string }) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!token) {
        setStatus('error');
        setError('Token em falta na URL.');
        return;
      }
      setStatus('loading');
      try {
        const res = await fetch('/api/auth-by-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !data?.ok) {
          setStatus('error');
          setError(data?.error || 'Token invalido ou expirado.');
          return;
        }
        setStatus('ok');
        setTimeout(() => {
          window.location.href = '/';
        }, 800);
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setError('Erro de rede.');
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(201,169,110,0.2)',
        borderRadius: 12,
        padding: 40,
        maxWidth: 420,
        width: '100%',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          background: '#c9a96e',
          borderRadius: 8,
          margin: '0 auto 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 700,
          fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
          fontSize: 26,
        }}
      >
        G
      </div>
      <h1
        style={{
          fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
          fontSize: 24,
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        {status === 'ok'
          ? 'Bem-vindo!'
          : status === 'error'
            ? 'Acesso negado'
            : 'A validar acesso...'}
      </h1>
      <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 24 }}>
        {status === 'loading' || status === 'idle'
          ? 'A preparar o seu ambiente demo.'
          : status === 'ok'
            ? 'A redirecionar para o dashboard...'
            : error}
      </p>
      {status === 'error' ? (
        <a
          href="/login"
          style={{
            display: 'inline-block',
            background: '#c9a96e',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.5px',
            textDecoration: 'none',
          }}
        >
          Ir para Login
        </a>
      ) : null}
    </div>
  );
}
