'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { Lock, Mail, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { emailExists } from '@/lib/users';

function validEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export function RegisterForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!firstName.trim()) next.firstName = 'First name is required.';
    if (!lastName.trim()) next.lastName = 'Last name is required.';
    if (!validEmail(email)) next.email = 'Enter a valid work email.';
    if (password.length < 8) next.password = 'Password must be at least 8 characters.';
    if (password !== confirm) next.confirm = 'Passwords must match.';
    if (email.trim() && (await emailExists(email))) next.email = 'This email is already registered.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data?.ok) {
        toast(data?.error || 'Nao foi possivel submeter o pedido.', 'error');
        return;
      }
      toast('Your access request has been submitted. An administrator will activate your account.', 'success');
      router.replace('/login');
    } catch {
      toast('Network error. Try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const valid =
    firstName.trim() &&
    lastName.trim() &&
    validEmail(email) &&
    password.length >= 8 &&
    password === confirm;

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-[400px] space-y-5">
      <div className="text-center">
        <h1 className="font-heading text-[28px] font-semibold text-gm-ink">Request access</h1>
        <p className="mt-2 text-sm text-gm-ink-secondary">
          Create your GodManager credentials. Your organization admin must approve before you can sign in.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="reg-first" className="text-xs font-semibold uppercase tracking-wider text-gm-amber">
            First name
          </label>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gm-ink-secondary" />
            <Input
              id="reg-first"
              value={firstName}
              onChange={(ev) => setFirstName(ev.target.value)}
              className="pl-10"
              error={errors.firstName}
              autoComplete="given-name"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="reg-last" className="text-xs font-semibold uppercase tracking-wider text-gm-amber">
            Last name
          </label>
          <Input
            id="reg-last"
            value={lastName}
            onChange={(ev) => setLastName(ev.target.value)}
            error={errors.lastName}
            autoComplete="family-name"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="reg-email" className="text-xs font-semibold uppercase tracking-wider text-gm-amber">
          Work email
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gm-ink-secondary" />
          <Input
            id="reg-email"
            type="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            className="pl-10"
            error={errors.email}
            autoComplete="email"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="reg-password" className="text-xs font-semibold uppercase tracking-wider text-gm-amber">
          Password
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gm-ink-secondary" />
          <Input
            id="reg-password"
            type="password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            className="pl-10"
            error={errors.password}
            autoComplete="new-password"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="reg-confirm" className="text-xs font-semibold uppercase tracking-wider text-gm-amber">
          Confirm password
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gm-ink-secondary" />
          <Input
            id="reg-confirm"
            type="password"
            value={confirm}
            onChange={(ev) => setConfirm(ev.target.value)}
            className="pl-10"
            error={errors.confirm}
            autoComplete="new-password"
          />
        </div>
      </div>

      <Button type="submit" size="lg" disabled={loading || !valid} className="w-full" aria-busy={loading}>
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Submitting request…
          </span>
        ) : (
          'Submit request'
        )}
      </Button>

      <p className="text-center text-sm text-gm-ink-secondary">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-gm-amber hover:text-gm-amber-light">
          Sign in
        </Link>
      </p>
    </form>
  );
}
