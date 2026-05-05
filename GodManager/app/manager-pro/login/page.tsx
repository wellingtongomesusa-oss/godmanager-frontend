'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { setSession } from '@/lib/manager-pro/auth';

/**
 * Login GodManager.One — sessão no browser (MP_SESSION_KEY) + cookie httpOnly das APIs (/api/auth/*).
 */
export default function ManagerProLoginPage() {
  const router = useRouter();
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

      const u = json.user;
      if (!u?.email) {
        setError('Resposta invalida do servidor.');
        setLoading(false);
        return;
      }

      const name =
        `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || String(u.email);

      setSession({
        email: u.email,
        name,
        at: new Date().toISOString(),
      });

      router.replace('/manager-pro');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen flex-col bg-[var(--sand)] px-6 py-12"
      style={{ fontFamily: 'var(--font-sora), system-ui, sans-serif' }}
    >
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink3)]">
            GodManager.One
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-[var(--ink)]">
            Entrar no painel
          </h1>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--paper)] p-8 shadow-[0_4px_24px_rgba(26,26,28,.06)]">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="mp-email"
                className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--ink3)]"
              >
                Email
              </label>
              <input
                id="mp-email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-[var(--border2)] bg-[var(--sand)] px-3 py-2.5 text-sm text-[var(--ink)] focus:border-[var(--amber)] focus:outline-none focus:ring-[3px] focus:ring-[rgba(201,169,110,.12)]"
              />
            </div>
            <div>
              <label
                htmlFor="mp-password"
                className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--ink3)]"
              >
                Senha
              </label>
              <input
                id="mp-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[var(--border2)] bg-[var(--sand)] px-3 py-2.5 text-sm text-[var(--ink)] focus:border-[var(--amber)] focus:outline-none focus:ring-[3px] focus:ring-[rgba(201,169,110,.12)]"
              />
            </div>

            {error ? (
              <p className="rounded-lg border border-[var(--red-bg)] bg-[var(--red-bg)] px-3 py-2 text-xs text-[var(--red)]">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[var(--amber)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(201,169,110,.25)] transition hover:opacity-95 disabled:pointer-events-none disabled:opacity-50"
            >
              {loading ? 'A entrar…' : 'Entrar'}
            </button>
          </form>

          <p className="mt-6 border-t border-[var(--border)] pt-5 text-center text-[11px] text-[var(--ink3)]">
            Portais diferentes: proprietarios usam{' '}
            <a
              href="/owner-portal/login"
              className="font-semibold text-[var(--amber)] underline-offset-2 hover:underline"
            >
              Portal do proprietario
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
