'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Home, KeyRound, LogOut, Settings, Shield, Users } from 'lucide-react';
import { GodManagerLogo } from '@/components/layout/GodManagerLogo';
import { Avatar } from '@/components/ui/avatar';
import { useAuth } from '@/components/auth/AuthProvider';
import { cn } from '@/lib/utils';

type Item = { href: string; label: string; icon: typeof Users };

const mainNav: Item[] = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/account/password', label: 'Password', icon: KeyRound },
];

const adminSections: { label: string; items: Item[] }[] = [
  {
    label: 'Management',
    items: [{ href: '/admin/users', label: 'Users', icon: Users }],
  },
  {
    label: 'Operations',
    items: [
      { href: '/admin/roles', label: 'Roles & Permissions', icon: Shield },
      { href: '/admin/audit', label: 'Audit Log', icon: FileText },
    ],
  },
  {
    label: 'Settings',
    items: [{ href: '/admin/settings', label: 'System Settings', icon: Settings }],
  },
];

export function MainSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <aside
      className="fixed bottom-0 left-0 top-0 z-40 hidden w-[240px] flex-col border-r border-white/10 bg-gm-sidebar lg:flex"
      aria-label="Main navigation"
    >
      <div className="border-b border-white/10 px-4 py-5">
        <GodManagerLogo size="sm" surface="dark" />
      </div>

      <div className="flex flex-1 flex-col gap-8 overflow-y-auto px-3 py-6">
        <div>
          <p className="mb-2 px-3 text-[8.5px] font-semibold uppercase tracking-[1.6px] text-white/25">Main</p>
          <ul className="space-y-0.5">
            {mainNav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12.5px] font-medium transition-colors',
                      active
                        ? 'border-l-[3px] border-gm-amber bg-gm-amber/10 text-gm-amber'
                        : 'border-l-[3px] border-transparent text-white/70 hover:bg-white/5 hover:text-white',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {user.role === 'admin'
          ? adminSections.map((sec) => (
              <div key={sec.label}>
                <p className="mb-2 px-3 text-[8.5px] font-semibold uppercase tracking-[1.6px] text-white/25">
                  {sec.label}
                </p>
                <ul className="space-y-0.5">
                  {sec.items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-medium transition-colors',
                            active
                              ? 'border-l-[3px] border-gm-amber bg-gm-amber/10 text-gm-amber'
                              : 'border-l-[3px] border-transparent text-white/70 hover:bg-white/5 hover:text-white',
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" aria-hidden />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          : null}
      </div>

      <div className="mt-auto border-t border-white/10 p-4">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar firstName={user.firstName} lastName={user.lastName} size="sm" variant="sidebar" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-white">
              {user.firstName} {user.lastName}
            </p>
            <p className="truncate text-[10px] uppercase tracking-wide text-white/40">{user.role}</p>
          </div>
          <button
            type="button"
            aria-label="Log out"
            onClick={logout}
            className="shrink-0 rounded-lg p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-gm-amber"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
