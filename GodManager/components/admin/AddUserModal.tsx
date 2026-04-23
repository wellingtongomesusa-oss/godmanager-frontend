'use client';

import { useState } from 'react';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import type { User, UserRole } from '@/lib/types';
import { createUser, listUsers } from '@/lib/users';

const PERM_OPTS = [
  { key: 'payments', label: 'Can approve payments' },
  { key: 'properties', label: 'Can manage properties' },
  { key: 'financials', label: 'Can view financials' },
  { key: 'export', label: 'Can export data' },
] as const;

function generateStrongPassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*';
  const all = upper + lower + digits + symbols;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  let pwd = pick(upper) + pick(lower) + pick(digits) + pick(symbols);
  for (let i = 4; i < length; i++) pwd += pick(all);
  return pwd
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

export function AddUserModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (u: User) => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('viewer');
  const [perms, setPerms] = useState<Record<string, boolean>>({
    payments: false,
    properties: false,
    financials: false,
    export: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ user: User; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setShowPassword(false);
    setRole('viewer');
    setPerms({ payments: false, properties: false, financials: false, export: false });
    setErrors({});
    setResult(null);
    setCopied(false);
  };

  const handleGenerate = () => {
    const pwd = generateStrongPassword(12);
    setPassword(pwd);
    setShowPassword(true);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.alert('Erro ao copiar. Copie manualmente: ' + result.password);
    }
  };

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = 'Required';
    if (!lastName.trim()) e.lastName = 'Required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Valid email required';
    if (password && password.length < 8) e.password = 'Minimum 8 characters';

    if (!e.email) {
      const users = await listUsers();
      if (users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
        e.email = 'This email is already registered';
      }
    }
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    const finalPassword = password.trim() || generateStrongPassword(12);
    const permissions = PERM_OPTS.filter((p) => perms[p.key]).map((p) => p.key);

    const res = await createUser({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || null,
      password: finalPassword,
      role,
      status: 'active',
      permissions,
    });
    setSaving(false);

    if (!res.ok) {
      window.alert('Erro: ' + res.error);
      return;
    }

    setResult({ user: res.user, password: finalPassword });
    onCreated(res.user);
  };

  const valid = Boolean(
    firstName.trim() && lastName.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  );

  if (result) {
    return (
      <Modal open={open} onClose={handleClose} title="User Created" className="max-w-[520px]">
        <div className="space-y-5">
          <div className="rounded-lg border border-gm-green/30 bg-gm-green/10 p-4">
            <p className="text-sm font-semibold text-gm-green">
              {result.user.firstName} {result.user.lastName} created
            </p>
            <p className="mt-1 text-xs text-gm-ink-secondary">
              {result.user.email} · {result.user.role}
            </p>
          </div>
          <div>
            <label className="mb-2 block text-[9px] font-semibold uppercase tracking-[0.2em] text-gm-amber">
              Password
            </label>
            <div className="flex gap-2">
              <code className="flex-1 rounded-lg border border-gm-border bg-gm-sand px-4 py-3 font-mono text-sm text-gm-ink">
                {result.password}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gm-amber bg-gm-amber px-4 py-3 text-xs font-semibold text-white hover:bg-gm-amber/90"
              >
                {copied ? <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden /> : <Copy className="h-4 w-4" strokeWidth={2} aria-hidden />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="mt-2 text-xs text-gm-ink-tertiary">
              Esta palavra-passe nao volta a aparecer. Copie agora e envie ao utilizador de forma segura.
            </p>
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="primary" onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add User" className="max-w-[520px]">
      <div className="space-y-6">
        <section>
          <p className="mb-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-gm-amber">Personal information</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-gm-ink-secondary">First name</label>
              <Input value={firstName} onChange={(ev) => setFirstName(ev.target.value)} error={errors.firstName} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gm-ink-secondary">Last name</label>
              <Input value={lastName} onChange={(ev) => setLastName(ev.target.value)} error={errors.lastName} />
            </div>
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-xs text-gm-ink-secondary">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              error={errors.email}
            />
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-xs text-gm-ink-secondary">Phone (optional)</label>
            <Input value={phone} onChange={(ev) => setPhone(ev.target.value)} />
          </div>
        </section>

        <section>
          <p className="mb-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-gm-amber">Password</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <div className={password ? 'pr-24' : undefined}>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                  placeholder="Leave empty to auto-generate"
                  error={errors.password}
                />
              </div>
              {password ? (
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-[11px] flex items-center gap-1 text-xs text-gm-ink-tertiary hover:text-gm-ink"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" strokeWidth={1.75} />
                  ) : (
                    <Eye className="h-4 w-4" strokeWidth={1.75} />
                  )}
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              className="shrink-0 rounded-lg border border-gm-amber bg-gm-amber/10 px-3 py-2 text-xs font-semibold text-gm-amber hover:bg-gm-amber/20"
              title="Generate strong password"
            >
              Generate
            </button>
          </div>
          <p className="mt-2 text-xs text-gm-ink-tertiary">Minimum 8 characters. Empty = auto-generated.</p>
        </section>

        <section>
          <p className="mb-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-gm-amber">Role & Access</p>
          <div>
            <label className="mb-1 block text-xs text-gm-ink-secondary">Role</label>
            <select
              value={role}
              onChange={(ev) => setRole(ev.target.value as UserRole)}
              className="w-full rounded-lg border border-gm-border bg-white px-3 py-2 text-sm"
            >
              <option value="admin">Admin</option>
              <option value="manager">Property Manager</option>
              <option value="accountant">Accountant</option>
              <option value="leasing">Leasing</option>
              <option value="maintenance">Maintenance</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div className="mt-3 space-y-2">
            {PERM_OPTS.map((p) => (
              <label key={p.key} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={perms[p.key]}
                  onChange={(ev) => setPerms({ ...perms, [p.key]: ev.target.checked })}
                />
                {p.label}
              </label>
            ))}
          </div>
        </section>

        <div className="flex justify-end gap-3 border-t border-gm-border pt-4">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!valid || saving}>
            {saving ? 'Creating...' : 'Create User'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
