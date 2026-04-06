'use client';

import { Clock, ShieldAlert, UserCheck, Users } from 'lucide-react';
import type { User } from '@/lib/types';

export function UserKPICards({ users }: { users: User[] }) {
  const total = users.length;
  const active = users.filter((u) => u.status === 'active').length;
  const suspended = users.filter((u) => u.status === 'suspended').length;
  const pending = users.filter((u) => u.status === 'pending').length;

  const cards = [
    { label: 'Total Users', value: total, icon: Users, accent: 'text-gm-ink' },
    { label: 'Active', value: active, icon: UserCheck, accent: 'text-gm-green' },
    { label: 'Suspended', value: suspended, icon: ShieldAlert, accent: 'text-gm-red' },
    { label: 'Pending Invite', value: pending, icon: Clock, accent: 'text-gm-amber' },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className="rounded-gm border border-gm-border bg-gm-paper p-6 shadow-gm-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-gm-card-hover"
          >
            <div className="flex items-start justify-between">
              <Icon className={`h-8 w-8 ${c.accent}`} aria-hidden />
            </div>
            <p className="mt-4 font-mono text-[26px] font-bold leading-none text-gm-ink">{c.value}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-gm-ink-secondary">
              {c.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}
