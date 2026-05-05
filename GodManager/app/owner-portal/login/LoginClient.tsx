'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';

export default function LoginClient() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const json = await res.json();

      if (!json.ok) {
        setError(json.message ?? json.error ?? 'Credenciais invalidas.');
        setLoading(false);
        return;
      }

      const role = json.user?.role;
      if (role !== 'owner' && role !== 'super_admin') {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
        }).catch(() => {});
        setError('Esta entrada e apenas para proprietarios.');
        setLoading(false);
        return;
      }

      window.location.href = '/owner-portal';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gm-cream font-body antialiased">
      <div className="bg-gm-sidebar text-white">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gm-amber">
            Manager Prop
          </p>
          <h1 className="mt-1 font-heading text-2xl font-semibold">
            Portal do Proprietario
          </h1>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-gm border border-gm-border bg-gm-paper p-8 shadow-gm-card">
            <h2 className="mb-2 font-heading text-xl font-semibold text-gm-ink">
              Entrar
            </h2>
            <p className="mb-6 text-[13px] text-gm-ink-secondary">
              Acesse seu demonstrativo mensal e antecipacao de credito.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gm-ink-tertiary"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-[7px] border border-gm-border-strong bg-gm-sand px-3 py-2 text-[13px] text-gm-ink focus:border-gm-amber focus:outline-none focus:ring-[3px] focus:ring-gm-amber/20"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gm-ink-tertiary"
                >
                  Senha
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-[7px] border border-gm-border-strong bg-gm-sand px-3 py-2 text-[13px] text-gm-ink focus:border-gm-amber focus:outline-none focus:ring-[3px] focus:ring-gm-amber/20"
                />
              </div>

              {error ? (
                <div className="rounded-[7px] border border-gm-red-bg bg-gm-red-bg p-3 text-[13px] text-gm-red">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading || !email.trim() || !password}
                className="w-full rounded-[8px] bg-gm-amber px-4 py-2 text-[13px] font-semibold text-white shadow-gm-amber transition hover:bg-gm-amber-light disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <p className="mt-6 text-center text-[11px] text-gm-ink-tertiary">
              Esqueceu a senha? Entre em contato com seu gestor.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
