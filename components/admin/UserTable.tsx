'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { User, UserRole, UserStatus } from '@/lib/types';
import { formatDate, relativeTime } from '@/lib/utils';

function roleBadgeVariant(
  r: UserRole,
): 'admin' | 'manager' | 'accountant' | 'leasing' | 'maintenance' | 'viewer' {
  if (r === 'admin') return 'admin';
  if (r === 'manager') return 'manager';
  if (r === 'accountant') return 'accountant';
  if (r === 'leasing') return 'leasing';
  if (r === 'maintenance') return 'maintenance';
  return 'viewer';
}

function statusVariant(s: UserStatus): 'active' | 'suspended' | 'pending' {
  if (s === 'active') return 'active';
  if (s === 'suspended') return 'suspended';
  return 'pending';
}

function statusLabel(s: UserStatus): string {
  if (s === 'active') return 'Active';
  if (s === 'suspended') return 'Suspended';
  return 'Pending';
}

function roleLabel(r: UserRole): string {
  if (r === 'manager') return 'Property Manager';
  return r.charAt(0).toUpperCase() + r.slice(1);
}

export function UserTable({
  users,
  page,
  pageSize,
  onEdit,
  onResetPassword,
  onToggleSuspend,
  onDelete,
}: {
  users: User[];
  page: number;
  pageSize: number;
  onEdit: (u: User) => void;
  onResetPassword: (u: User) => void;
  onToggleSuspend: (u: User) => void;
  onDelete: (u: User) => void;
}) {
  const [menu, setMenu] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const start = (page - 1) * pageSize;
  const slice = users.slice(start, start + pageSize);

  return (
    <div className="overflow-hidden rounded-gm border border-gm-border bg-gm-paper">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b border-gm-border bg-gm-cream">
              <th className="px-[14px] py-2.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-gm-ink-tertiary">
                User
              </th>
              <th className="px-[14px] py-2.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-gm-ink-tertiary">
                Role
              </th>
              <th className="px-[14px] py-2.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-gm-ink-tertiary">
                Status
              </th>
              <th className="px-[14px] py-2.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-gm-ink-tertiary">
                Last active
              </th>
              <th className="px-[14px] py-2.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-gm-ink-tertiary">
                Created
              </th>
              <th className="w-12 px-2 py-3" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {slice.map((u, i) => (
              <tr
                key={u.id}
                className="gm-stagger-item border-b border-gm-border transition-colors hover:bg-gm-amber/[0.04]"
                style={{ animationDelay: `${Math.min(i * 50, 500)}ms` }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar firstName={u.firstName} lastName={u.lastName} size="sm" />
                    <div>
                      <p className="font-semibold text-gm-ink">
                        {u.firstName} {u.lastName}
                      </p>
                      <p className="text-xs text-gm-ink-secondary">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={roleBadgeVariant(u.role)}>{roleLabel(u.role)}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(u.status)}>{statusLabel(u.status)}</Badge>
                </td>
                <td className="px-4 py-3 text-gm-ink-secondary" title={new Date(u.lastActive).toLocaleString()}>
                  {relativeTime(u.lastActive)}
                </td>
                <td className="px-4 py-3 text-gm-ink-secondary">{formatDate(u.createdAt)}</td>
                <td className="px-2 py-3">
                  <div className="relative" ref={menu === u.id ? ref : undefined}>
                  <button
                    type="button"
                    aria-label={`Actions for ${u.email}`}
                    aria-expanded={menu === u.id}
                    onClick={() => setMenu(menu === u.id ? null : u.id)}
                    className="rounded-lg p-2 text-gm-ink-secondary hover:bg-gm-cream hover:text-gm-amber"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {menu === u.id ? (
                    <div
                      role="menu"
                      className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-gm-border bg-gm-paper py-1 shadow-xl"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        className="block w-full px-4 py-2 text-left text-sm hover:bg-gm-amber-bg"
                        onClick={() => {
                          setMenu(null);
                          onEdit(u);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="block w-full px-4 py-2 text-left text-sm hover:bg-gm-amber-bg"
                        onClick={() => {
                          setMenu(null);
                          onResetPassword(u);
                        }}
                      >
                        Reset password
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="block w-full px-4 py-2 text-left text-sm hover:bg-gm-amber-bg"
                        onClick={() => {
                          setMenu(null);
                          onToggleSuspend(u);
                        }}
                      >
                        {u.status === 'suspended' ? 'Activate' : 'Suspend'}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="block w-full px-4 py-2 text-left text-sm text-gm-red hover:bg-gm-red/10"
                        onClick={() => {
                          setMenu(null);
                          onDelete(u);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-gm-border px-4 py-3 text-xs text-gm-ink-secondary">
        Showing {users.length === 0 ? 0 : start + 1}-{Math.min(start + pageSize, users.length)} of {users.length}{' '}
        users
      </div>
    </div>
  );
}
