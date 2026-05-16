'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Link, useRouter } from '@/i18n/navigation';
import { SiteHeader } from '@/components/landing/SiteHeader';

type ValidateState =
  | { status: 'loading' }
  | { status: 'error'; msg: string; code?: string }
  | { status: 'ok'; email: string | null; note: string | null };

function SignupTrialInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') || '';

  const [gate, setGate] = useState<ValidateState>({ status: 'loading' });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const canShowForm = gate.status === 'ok';

  const validateHref = useMemo(() => `/api/admin/trial-invites/validate?token=${encodeURIComponent(token)}`, [token]);

  useEffect(() => {
    if (!token.trim()) {
      setGate({
        status: 'error',
        msg: 'Não foi encontrado um convite válido neste link.',
        code: 'missing_token',
      });
      return;
    }

    let cancelled = false;
    async function run() {
      setGate({ status: 'loading' });
      try {
        const res = await fetch(validateHref, { method: 'GET', credentials: 'same-origin' });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (res.ok && data?.ok) {
          const pre = typeof data.email === 'string' && data.email.trim() ? data.email.trim() : '';
          setEmail(pre.toLowerCase());
          setGate({ status: 'ok', email: pre || null, note: typeof data.note === 'string' ? data.note : null });
        } else if (res.status === 410) {
          const m =
            typeof data?.error === 'string' ? data.error : 'Este convite expirou ou já foi utilizado.';
          setGate({ status: 'error', msg: m, code: String(data?.error || 'gone') });
        } else if (res.status === 404) {
          setGate({
            status: 'error',
            msg: 'O token do convite é inválido ou não existe.',
            code: 'invalid_token',
          });
        } else {
          setGate({
            status: 'error',
            msg: typeof data?.error === 'string' ? data.error : 'Não foi possível validar o convite.',
          });
        }
      } catch {
        if (!cancelled) setGate({ status: 'error', msg: 'Falha de rede ao validar o convite.' });
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [token, validateHref]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError('');
      if (!token.trim()) {
        setFormError('Convite ausente.');
        return;
      }
      if (!name.trim() || name.trim().length < 2) {
        setFormError('Informe nome e sobrenome (nome completo).');
        return;
      }
      if (!email.trim() || !email.includes('@')) {
        setFormError('Informe um e-mail válido.');
        return;
      }
      if (password.length < 8) {
        setFormError('A senha deve ter pelo menos 8 caracteres.');
        return;
      }
      if (!companyName.trim()) {
        setFormError('Informe o nome da empresa.');
        return;
      }

      setBusy(true);
      try {
        const body = {
          trialToken: token.trim(),
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          companyName: companyName.trim(),
          segment: 'LONG_TERM',
          packageTier: 1,
          avgRent: 2500,
          unitCount: 1,
          interval: 'MONTHLY',
        };
        const res = await fetch('/api/auth/register-with-trial', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          credentials: 'same-origin',
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok && data?.ok) {
          router.push(`/login?email=${encodeURIComponent(String(body.email || ''))}`);
          return;
        }

        let msg =
          typeof data?.message === 'string'
            ? data.message
            : typeof data?.error === 'string'
              ? data.error
              : 'Não foi possível concluir o registo.';
        if (data?.error === 'email_mismatch_invite' && gate.status === 'ok' && gate.email) {
          msg = `Este convite está ligado ao e-mail ${gate.email}.`;
        }
        setFormError(msg);
      } catch {
        setFormError('Erro de rede ao submeter.');
      } finally {
        setBusy(false);
      }
    },
    [token, name, email, password, companyName, router, gate],
  );

  return (
    <main className="min-h-screen bg-[#f5f0e8] py-16 px-6">
      <div className="mx-auto max-w-xl">
        <div className="rounded-2xl border border-[#e7dfd2] bg-white p-10 shadow-[0_12px_40px_rgba(30,43,61,.06)]">
          {gate.status === 'loading' && (
            <div className="text-center">
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                godmanager.com
              </p>
              <p className="text-sm text-slate-600">A validar o seu convite de trial...</p>
            </div>
          )}

          {gate.status === 'error' && (
            <div className="text-center">
              <h1 className="mb-3 text-center font-serif text-3xl text-[#1e2b3d]">
                Convite não disponível
              </h1>
              <p className="mb-6 text-sm leading-relaxed text-slate-600">{gate.msg}</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  href="/contacto"
                  className="rounded-lg bg-[#c9a961] px-7 py-3 text-sm font-semibold text-white transition-all hover:bg-[#b08f4a]"
                >
                  Falar connosco
                </Link>
                <Link
                  href="/savings"
                  className="rounded-lg border border-[#1e2b3d] bg-transparent px-7 py-3 text-sm font-semibold text-[#1e2b3d] transition-all hover:bg-slate-50"
                >
                  Ver preços
                </Link>
              </div>
            </div>
          )}

          {canShowForm && (
            <>
              <p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Convite válido · trial GodManager
              </p>
              <h1 className="mb-3 text-center font-serif text-3xl text-[#1e2b3d]">
                Crie a sua conta
              </h1>
              <p className="mb-6 text-center text-sm leading-relaxed text-slate-600">
                Trial de 30 dias após activação da subscrição. Os valores de pacote inicial seguem os defaults de
                long-term (podem ser afinados pela equipa após onboarding).
              </p>
              {gate.note ? (
                <p className="mb-6 rounded-xl border border-dashed border-slate-200 bg-[#faf8f4] px-4 py-3 text-xs leading-relaxed text-slate-600">
                  Ref. interno: <span className="font-medium text-[#1e2b3d]">{gate.note}</span>
                </p>
              ) : null}

              <form onSubmit={onSubmit} className="grid gap-4 text-left">
                <div>
                  <label htmlFor="st-name" className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    Nome completo
                  </label>
                  <input
                    id="st-name"
                    name="name"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-[#d9d4c9] bg-[#faf8f4] px-3 py-2.5 text-sm text-[#1e2b3d] outline-none ring-amber-900/15 focus:border-[#c9a961] focus:ring-[3px]"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="st-email" className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    E-mail
                  </label>
                  <input
                    id="st-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    readOnly={Boolean(gate.email)}
                    aria-readonly={Boolean(gate.email)}
                    className="w-full rounded-lg border border-[#d9d4c9] bg-[#faf8f4] px-3 py-2.5 text-sm text-[#1e2b3d] outline-none ring-amber-900/15 focus:border-[#c9a961] focus:ring-[3px] read-only:bg-slate-100"
                    required
                  />
                  {gate.email ? (
                    <p className="mt-1 text-[11px] text-slate-500">Este convite está associado ao e-mail acima.</p>
                  ) : null}
                </div>
                <div>
                  <label htmlFor="st-password" className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    Senha (mín. 8 caracteres)
                  </label>
                  <input
                    id="st-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-[#d9d4c9] bg-[#faf8f4] px-3 py-2.5 text-sm text-[#1e2b3d] outline-none ring-amber-900/15 focus:border-[#c9a961] focus:ring-[3px]"
                    required
                    minLength={8}
                  />
                </div>
                <div>
                  <label htmlFor="st-company" className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    Empresa
                  </label>
                  <input
                    id="st-company"
                    name="companyName"
                    autoComplete="organization"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full rounded-lg border border-[#d9d4c9] bg-[#faf8f4] px-3 py-2.5 text-sm text-[#1e2b3d] outline-none ring-amber-900/15 focus:border-[#c9a961] focus:ring-[3px]"
                    required
                  />
                </div>

                {formError ? (
                  <div className="rounded-lg border border-red-100 bg-[#fdf2f2] px-4 py-3 text-sm text-[#991b1b]">
                    {formError}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={busy}
                  className="mt-2 w-full rounded-lg bg-[#c9a961] py-3 text-sm font-semibold text-white shadow-[0_2px_12px_rgba(201,169,97,.25)] transition-colors hover:bg-[#b08f4a] disabled:pointer-events-none disabled:opacity-50"
                >
                  {busy ? 'A criar conta...' : 'Começar trial'}
                </button>
              </form>
              <p className="mt-6 text-center text-xs text-slate-500">
                Já tem conta?{' '}
                <Link href="/login" className="font-semibold text-[#c9a961] underline-offset-4 hover:underline">
                  Iniciar sessão
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function SignupTrialClient() {
  return (
    <>
      <SiteHeader active="savings" />
      <Suspense
        fallback={
          <main className="min-h-screen bg-[#f5f0e8] py-16 px-6">
            <div className="mx-auto max-w-xl text-center text-sm text-slate-600">Loading...</div>
          </main>
        }
      >
        <SignupTrialInner />
      </Suspense>
    </>
  );
}
