'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/financial', label: 'Financial Dashboard' },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-secondary-200 bg-secondary-50/90 backdrop-blur-sm">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-secondary-200 px-6">
          <Logo size="sm" />
          <span className="text-lg font-semibold text-secondary-900">
            Dashboard Godroox
          </span>
        </div>
        <nav className="flex-1 space-y-0.5 p-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center rounded-lg px-4 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-secondary-700 hover:bg-secondary-200/80 hover:text-secondary-900'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
