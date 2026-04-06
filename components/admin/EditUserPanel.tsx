'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SlideOver } from '@/components/ui/slide-over';
import { Avatar } from '@/components/ui/avatar';
import type { User, UserRole, UserStatus } from '@/lib/types';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/components/ui/toast';
import { emailExists, updateUser } from '@/lib/users';

const PERM_OPTS = [
  { key: 'payments', label: 'Can approve payments' },
  { key: 'properties', label: 'Can manage properties' },
  { key: 'financials', label: 'Can view financials' },
  { key: 'export', label: 'Can export data' },
] as const;

export function EditUserPanel({
  user,
  open,
  onClose,
  onSaved,
}: {
  user: User | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user: current } = useAuth();
  const { toast } = useToast();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('viewer');
  const [status, setStatus] = useState<UserStatus>('active');
  const [perms, setPerms] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setEmail(user.email);
    setPhone(user.phone ?? '');
    setRole(user.role);
    setStatus(user.status);
    const p: Record<string, boolean> = {};
    PERM_OPTS.forEach((o) => {
      p[o.key] = user.permissions.includes(o.key);
    });
    setPerms(p);
  }, [user]);

  if (!user) return null;

  const save = () => {
    const e = email.trim().toLowerCase();
    if (emailExists(e, user.id)) {
      toast('That email address is already assigned to another user.', 'error');
      return;
    }
    if (user.id === current?.id && status === 'suspended') {
      toast('You cannot suspend your own account.', 'error');
      return;
    }
    const permissions = PERM_OPTS.filter((p) => perms[p.key]).map((p) => p.key);
    updateUser(user.id, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || undefined,
      role,
      status,
      permissions,
    });
    onSaved();
    onClose();
  };

  return (
    <SlideOver open={open} onClose={onClose} title="Edit user">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Avatar firstName={firstName} lastName={lastName} size="lg" />
          <div>
            <p className="font-heading text-xl font-semibold text-gm-ink">
              {firstName} {lastName}
            </p>
            <p className="text-sm text-gm-ink-secondary">{email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-gm-ink-secondary">First name</label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gm-ink-secondary">Last name</label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gm-ink-secondary">Email</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gm-ink-secondary">Phone</label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gm-ink-secondary">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="w-full rounded-[10px] border border-gm-border bg-gm-cream px-4 py-3 text-sm text-gm-ink"
          >
            <option value="admin">Admin</option>
            <option value="manager">Property Manager</option>
            <option value="accountant">Accountant</option>
            <option value="leasing">Leasing Agent</option>
            <option value="maintenance">Maintenance</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>

        <section>
          <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-gm-amber">Account status</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={status === 'active'}
              onClick={() => setStatus(status === 'active' ? 'suspended' : 'active')}
              className={`relative h-7 w-12 rounded-full transition-colors ${status === 'active' ? 'bg-gm-green/40' : 'bg-gm-red/40'}`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${status === 'active' ? 'left-6' : 'left-1'}`}
              />
            </button>
            <span className="text-sm text-gm-ink-secondary">{status === 'active' ? 'Active' : 'Suspended'}</span>
          </div>
          <p className="mt-3 text-xs text-gm-ink-secondary">Last login: {new Date(user.lastActive).toLocaleString()}</p>
          <p className="text-xs text-gm-ink-secondary">Created: {new Date(user.createdAt).toLocaleString()}</p>
        </section>

        <div className="space-y-2">
          {PERM_OPTS.map((p) => (
            <label key={p.key} className="flex cursor-pointer items-center gap-2 text-sm text-gm-ink-secondary">
              <input
                type="checkbox"
                checked={!!perms[p.key]}
                onChange={(e) => setPerms((x) => ({ ...x, [p.key]: e.target.checked }))}
                className="h-4 w-4 rounded border-gm-border bg-gm-cream text-gm-amber"
              />
              {p.label}
            </label>
          ))}
        </div>

        <div className="flex gap-3 border-t border-gm-border pt-4">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" className="flex-1" onClick={save}>
            Save changes
          </Button>
        </div>
      </div>
    </SlideOver>
  );
}
