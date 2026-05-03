'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Home, KeyRound, Settings, Shield, Users } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { cn } from '@/lib/utils';

const adminItems = [
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/roles', label: 'Roles', icon: Shield },
  { href: '/admin/audit', label: 'Audit', icon: FileText },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
] as const;

export function AdminMobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user) return null;

  const baseItems = [
    { href: '/dashboard', label: 'Home', icon: Home },
    { href: '/account/password', label: 'Password', icon: KeyRound },
  ] as const;
  const items =
    user.role === 'admin' || user.role === 'super_admin' ? [...baseItems, ...adminItems] : [...baseItems];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-gm-border bg-gm-paper/95 px-1 py-2 backdrop-blur-[16px] lg:hidden"
      aria-label="Mobile navigation"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-1 flex-col items-center gap-0.5 rounded-lg py-2 text-[10px] font-semibold transition-colors',
              active ? 'text-gm-amber' : 'text-gm-ink-secondary hover:text-gm-ink',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
