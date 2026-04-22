'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { hashPassword } from '@/lib/password';
import type { User, UserRole } from '@/lib/types';
import { createUser, emailExists, primeUserCreatePassword } from '@/lib/users';

const PERM_OPTS = [
  { key: 'payments', label: 'Can approve payments' },
  { key: 'properties', label: 'Can manage properties' },
  { key: 'financials', label: 'Can view financials' },
  { key: 'export', label: 'Can export data' },
] as const;

function uuid(): string {
  return crypto.randomUUID();
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
  const [role, setRole] = useState<UserRole>('viewer');
  const [perms, setPerms] = useState<Record<string, boolean>>({
    payments: false,
    properties: false,
    financials: false,
    export: false,
  });
  const [welcome, setWelcome] = useState(true);
  const [requirePw, setRequirePw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reset = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setRole('viewer');
    setPerms({ payments: false, properties: false, financials: false, export: false });
    setWelcome(true);
    setRequirePw(false);
    setErrors({});
  };

  const submit = () => {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = 'Required';
    if (!lastName.trim()) e.lastName = 'Required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Valid email required';
    if (emailExists(email)) e.email = 'This email is already registered';
    setErrors(e);
    if (Object.keys(e).length) return;

    const permissions = PERM_OPTS.filter((p) => perms[p.key]).map((p) => p.key);
    const tempPass = `GmTemp${Math.random().toString(36).slice(2, 10)}!`;
    const user: User = {
      id: uuid(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || undefined,
      role,
      status: 'pending',
      permissions,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      passwordHash: hashPassword(tempPass),
    };
    primeUserCreatePassword(tempPass);
    createUser(user);
    reset();
    onCreated(user);
    onClose();
  };

  const valid = firstName.trim() && lastName.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !emailExists(email);

  return (
    <Modal open={open} onClose={onClose} title="Add User" className="max-w-[520px]">
      <div className="space-y-6">
        <section>
          <p className="mb-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-gm-amber">
            Personal information
          </p>
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
          <p className="mb-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-gm-amber">
            Access & permissions
          </p>
          <label className="mb-2 block text-xs text-gm-ink-secondary">Role</label>
          <select
            value={role}
            onChange={(ev) => setRole(ev.target.value as UserRole)}
            className="w-full rounded-[10px] border border-gm-border bg-gm-cream px-4 py-3 text-sm text-gm-ink focus:border-gm-amber focus:outline-none focus:ring-[3px] focus:ring-gm-amber/20"
          >
            <option value="admin">Admin</option>
            <option value="manager">Property Manager</option>
            <option value="accountant">Accountant</option>
            <option value="leasing">Leasing Agent</option>
            <option value="maintenance">Maintenance</option>
            <option value="viewer">Viewer</option>
          </select>
          <div className="mt-4 space-y-2">
            {PERM_OPTS.map((p) => (
              <label key={p.key} className="flex cursor-pointer items-center gap-2 text-sm text-gm-ink-secondary">
                <input
                  type="checkbox"
                  checked={perms[p.key]}
                  onChange={(ev) => setPerms((x) => ({ ...x, [p.key]: ev.target.checked }))}
                  className="h-4 w-4 rounded border-gm-border bg-gm-cream text-gm-amber"
                />
                {p.label}
              </label>
            ))}
          </div>
        </section>

        <section>
          <p className="mb-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-gm-amber">
            Notification settings
          </p>
          <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm text-gm-ink-secondary">
            <input type="checkbox" checked={welcome} onChange={(ev) => setWelcome(ev.target.checked)} />
            Send welcome email
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gm-ink-secondary">
            <input type="checkbox" checked={requirePw} onChange={(ev) => setRequirePw(ev.target.checked)} />
            Require password change on first login
          </label>
        </section>

        <div className="flex justify-end gap-3 border-t border-gm-border pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!valid} onClick={submit}>
            Create User
          </Button>
        </div>
      </div>
    </Modal>
  );
}
