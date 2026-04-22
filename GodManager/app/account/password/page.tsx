'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { changePassword, getCurrentUser } from '@/lib/auth';
import type { User } from '@/lib/types';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const u = getCurrentUser();
    if (!u) {
      router.replace('/login');
      return;
    }
    setUser(u);
    setLoading(false);
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (newPwd !== confirmPwd) {
      setMsg({ type: 'error', text: 'Nova password e confirmacao nao coincidem.' });
      return;
    }
    if (newPwd.length < 8) {
      setMsg({ type: 'error', text: 'Password com pelo menos 8 caracteres.' });
      return;
    }
    setSubmitting(true);
    const result = await changePassword(oldPwd, newPwd);
    setSubmitting(false);
    if (!result.ok) {
      setMsg({ type: 'error', text: result.error });
      return;
    }
    setMsg({ type: 'ok', text: 'Password alterada com sucesso. Redirigindo...' });
    setOldPwd('');
    setNewPwd('');
    setConfirmPwd('');
    setTimeout(() => router.push('/dashboard'), 1500);
  }

  if (loading) {
    return <div className="p-8 text-gm-ink-secondary">A carregar...</div>;
  }

  return (
    <div className="min-h-[calc(100vh-54px)] bg-gm-sand p-6">
      <div className="mx-auto max-w-md">
        <h1 className="mb-1 font-heading text-2xl font-semibold text-gm-ink">Alterar password</h1>
        <p className="mb-6 text-sm text-gm-ink-secondary">
          Conta: <span className="font-medium text-gm-ink">{user?.email}</span>
        </p>
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-gm border border-gm-border bg-gm-paper p-6"
        >
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.15em] text-gm-amber">
              Password actual
            </label>
            <input
              type="password"
              value={oldPwd}
              onChange={(e) => setOldPwd(e.target.value)}
              required
              className="w-full rounded-lg border border-gm-border bg-gm-sand px-3 py-2 text-sm text-gm-ink outline-none focus:border-gm-amber focus:ring-[3px] focus:ring-gm-amber/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.15em] text-gm-amber">
              Nova password
            </label>
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border border-gm-border bg-gm-sand px-3 py-2 text-sm text-gm-ink outline-none focus:border-gm-amber focus:ring-[3px] focus:ring-gm-amber/20"
            />
            <p className="mt-1 text-[10px] text-gm-ink-secondary">Minimo 8 caracteres.</p>
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.15em] text-gm-amber">
              Confirmar nova password
            </label>
            <input
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border border-gm-border bg-gm-sand px-3 py-2 text-sm text-gm-ink outline-none focus:border-gm-amber focus:ring-[3px] focus:ring-gm-amber/20"
            />
          </div>
          {msg ? (
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                msg.type === 'ok' ? 'bg-gm-green-bg text-gm-green' : 'bg-gm-red-bg text-gm-red'
              }`}
            >
              {msg.text}
            </div>
          ) : null}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-gm-amber px-4 py-2.5 font-semibold text-white shadow-gm-amber transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'A alterar...' : 'Alterar password'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="rounded-lg border border-gm-border px-4 py-2.5 text-gm-ink transition-colors hover:bg-gm-cream"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
