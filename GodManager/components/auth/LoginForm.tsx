'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import Link from 'next/link';
import { login } from '@/lib/auth';
import { appendAudit } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

function validEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

/** E-mail completo ou utilizador (ex.: wellington.gomes). */
function validLoginId(v: string): boolean {
  const s = v.trim();
  if (!s) return false;
  if (validEmail(s)) return true;
  return /^[a-zA-Z0-9._-]{2,128}$/.test(s);
}

const inputLoginClass =
  'rounded-lg border-login-navy/12 bg-white pl-10 text-login-navy placeholder:text-login-muted/70 focus:border-login-gold focus:ring-[3px] focus:ring-login-gold/20';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    try {
      const r = localStorage.getItem('gm_remember_email');
      if (r) setEmail(r);
    } catch {
      /* ignore */
    }
  }, []);

  const from = searchParams.get('from') || '/dashboard';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!validLoginId(email)) next.email = 'Enter a valid email or username.';
    if (password.length < 8) next.password = 'Password must be at least 8 characters.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    const res = login(email.trim(), password);
    setLoading(false);

    if (!res.ok) {
      toast(res.error, 'error');
      return;
    }

    appendAudit({
      adminId: res.user.id,
      action: 'auth.login',
      details: `User signed in: ${res.user.email}`,
    });

    if (remember) {
      try {
        localStorage.setItem('gm_remember_email', email.trim());
      } catch {
        /* ignore */
      }
    } else {
      localStorage.removeItem('gm_remember_email');
    }

    toast('Signed in successfully.', 'success');
    const destination = from.startsWith('/') ? from : '/dashboard';
    const normalized = destination.replace(/\/$/, '') || '/';
    if (normalized === '/dashboard') {
      window.location.replace('/GodManager_Premium.html#longterm');
      return;
    }
    router.replace(destination);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-[400px] space-y-5 font-inter" noValidate>
      <div className="text-center">
        <h1 className="font-playfair text-[32px] font-semibold leading-tight text-login-navy sm:text-[36px]">
          Welcome back
        </h1>
        <p className="mt-2 text-[14px] text-login-muted">Sign in to your financial operations dashboard</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="login-email" className="text-[10px] font-semibold uppercase tracking-[0.2em] text-login-gold">
          Email ou utilizador
        </label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-login-muted"
            aria-hidden
          />
          <Input
            id="login-email"
            type="text"
            autoComplete="username"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setErrors((er) => ({ ...er, email: undefined }))}
            error={errors.email}
            className={inputLoginClass}
            aria-invalid={!!errors.email}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="login-password" className="text-[10px] font-semibold uppercase tracking-[0.2em] text-login-gold">
          Password
        </label>
        <div className="relative">
          <Lock
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-login-muted"
            aria-hidden
          />
          <Input
            id="login-password"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setErrors((er) => ({ ...er, password: undefined }))}
            error={errors.password}
            className={`${inputLoginClass} pr-12`}
            aria-invalid={!!errors.password}
          />
          <button
            type="button"
            aria-label={show ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
            aria-pressed={show}
            onClick={() => setShow((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md text-login-muted outline-none transition-colors hover:text-login-gold focus-visible:ring-2 focus-visible:ring-login-gold focus-visible:ring-offset-2"
          >
            {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 text-[13px]">
        <label className="flex cursor-pointer items-center gap-2 text-login-muted">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 rounded border-login-navy/20 text-login-gold focus:ring-login-gold focus:ring-offset-0"
          />
          Remember me
        </label>
        <button
          type="button"
          className="rounded-md font-semibold text-login-gold outline-none transition-colors hover:text-[#b8924f] focus-visible:ring-2 focus-visible:ring-login-gold focus-visible:ring-offset-2"
          onClick={() => toast('Password reset email sent', 'info')}
        >
          Forgot password?
        </button>
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={loading}
        className="w-full !bg-login-gold !shadow-none hover:!bg-[#b8924f] focus-visible:ring-offset-white"
        aria-busy={loading}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />
            Signing in…
          </span>
        ) : (
          'Sign In'
        )}
      </Button>

      <div className="relative py-2 text-center text-xs text-login-muted">
        <span className="relative z-10 bg-white px-3">or continue with</span>
        <div className="absolute left-0 right-0 top-1/2 h-px bg-login-navy/10" aria-hidden />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          aria-label="Continue with Google"
          className="border-login-navy/15 text-login-navy hover:border-login-gold hover:text-login-gold focus-visible:ring-offset-white"
          onClick={() => toast('Google sign-in is not configured in this demo.', 'warning')}
        >
          Google
        </Button>
        <Button
          type="button"
          variant="outline"
          aria-label="Continue with Microsoft"
          className="border-login-navy/15 text-login-navy hover:border-login-gold hover:text-login-gold focus-visible:ring-offset-white"
          onClick={() => toast('Microsoft sign-in is not configured in this demo.', 'warning')}
        >
          Microsoft
        </Button>
      </div>

      <p className="text-center text-[13px] text-login-muted">
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="font-semibold text-login-gold outline-none hover:text-[#b8924f] focus-visible:rounded focus-visible:ring-2 focus-visible:ring-login-gold focus-visible:ring-offset-2"
        >
          Request access
        </Link>
      </p>
    </form>
  );
}
