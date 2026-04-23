'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import type { User } from '@/lib/types';
import { updateUser } from '@/lib/users';

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

export function ResetPasswordModal({
  open,
  user,
  onClose,
  onReset,
}: {
  open: boolean;
  user: User | null;
  onClose: () => void;
  onReset: (u: User) => void;
}) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && user) {
      setPassword('');
      setShowPassword(false);
      setError('');
      setResult(null);
      setCopied(false);
    }
  }, [open, user?.id]);

  const reset = () => {
    setPassword('');
    setShowPassword(false);
    setSaving(false);
    setError('');
    setResult(null);
    setCopied(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleGenerate = () => {
    const pwd = generateStrongPassword(12);
    setPassword(pwd);
    setShowPassword(true);
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
    if (!user) return;
    const pwd = password.trim() || generateStrongPassword(12);
    if (pwd.length < 8) {
      setError('Minimum 8 characters');
      return;
    }
    setSaving(true);
    setError('');
    const res = await updateUser(user.id, { password: pwd });
    setSaving(false);
    if (!res.ok) {
      setError(res.error || 'Failed to reset');
      return;
    }
    setResult({ password: pwd });
    onReset(res.user);
  };

  if (!user) return null;

  if (result) {
    return (
      <Modal open={open} onClose={handleClose} title="Password reset" className="max-w-[520px]">
        <div className="space-y-5">
          <div className="rounded-lg border border-gm-green/30 bg-gm-green/10 p-4">
            <p className="text-sm font-semibold text-gm-green">
              Password reset for {user.firstName} {user.lastName}
            </p>
            <p className="mt-1 text-xs text-gm-ink-secondary">{user.email}</p>
          </div>
          <div>
            <label className="mb-2 block text-[9px] font-semibold uppercase tracking-[0.2em] text-gm-amber">New password</label>
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
              Copie e envie ao utilizador de forma segura. Esta palavra-passe nao volta a aparecer.
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
    <Modal open={open} onClose={handleClose} title={`Reset Password — ${user.firstName} ${user.lastName}`} className="max-w-[520px]">
      <div className="space-y-5">
        <div className="rounded-lg border border-gm-amber/30 bg-gm-amber/5 p-3">
          <p className="text-xs text-gm-ink-secondary">
            User: <strong className="text-gm-ink">{user.email}</strong>
          </p>
          <p className="mt-1 text-[11px] text-gm-ink-tertiary">A palavra-passe actual deste utilizador sera substituida.</p>
        </div>

        <div>
          <label className="mb-2 block text-[9px] font-semibold uppercase tracking-[0.2em] text-gm-amber">New password</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <div className={password ? 'pr-24' : undefined}>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                  placeholder="Leave empty to auto-generate"
                  error={error}
                />
              </div>
              {password ? (
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-[11px] text-gm-ink-tertiary hover:text-gm-ink"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              className="shrink-0 rounded-lg border border-gm-amber bg-gm-amber/10 px-3 py-2 text-xs font-semibold text-gm-amber hover:bg-gm-amber/20"
            >
              Generate
            </button>
          </div>
          <p className="mt-2 text-xs text-gm-ink-tertiary">Minimum 8 characters. Empty = auto-generated.</p>
        </div>

        <div className="flex justify-end gap-3 border-t border-gm-border pt-4">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={saving}>
            {saving ? 'Resetting...' : 'Reset Password'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
