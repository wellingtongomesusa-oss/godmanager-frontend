'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GodManagerLogo } from '@/components/layout/GodManagerLogo';
import { Avatar } from '@/components/ui/avatar';
import { Dropdown, DropdownItem } from '@/components/ui/dropdown';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/components/auth/AuthProvider';

const nav = [
  { href: '#services', label: 'Services' },
  { href: '#1099', label: '1099' },
  { href: '#invoice', label: 'Quick Invoice' },
  { href: '#why', label: 'Why Us' },
  { href: '#contact', label: 'Contact' },
];

export function TopBar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const roleBadge =
    user.role === 'admin'
      ? 'admin'
      : user.role === 'manager'
        ? 'manager'
        : user.role === 'accountant'
          ? 'accountant'
          : user.role === 'leasing'
            ? 'leasing'
            : user.role === 'maintenance'
              ? 'maintenance'
              : 'viewer';

  return (
    <header
      className="sticky top-0 z-30 flex h-[54px] items-center justify-between gap-4 border-b border-gm-border bg-gm-sand/95 px-4 backdrop-blur-[16px] sm:px-6"
      role="banner"
    >
      <div className="flex min-w-0 items-center gap-4 lg:w-[200px]">
        <div className="lg:hidden">
          <GodManagerLogo size="sm" surface="light" />
        </div>
      </div>

      <nav className="hidden flex-1 justify-center gap-8 md:flex" aria-label="Primary">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-[13px] font-medium text-gm-ink-secondary transition-colors hover:text-gm-amber"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-2 sm:gap-4">
        <Dropdown
          align="right"
          trigger={
            <div className="flex items-center gap-3 rounded-lg border border-transparent px-2 py-1 hover:border-gm-border">
              <Avatar firstName={user.firstName} lastName={user.lastName} size="sm" />
              <div className="hidden text-left sm:block">
                <p className="text-[13px] font-semibold text-gm-ink">
                  {user.firstName} {user.lastName}
                </p>
                <Badge variant={roleBadge} className="mt-0.5 !normal-case">
                  {user.role}
                </Badge>
              </div>
            </div>
          }
        >
          <DropdownItem onClick={() => (window.location.href = '/dashboard')}>Profile</DropdownItem>
          <DropdownItem
            onClick={() => (window.location.href = pathname.startsWith('/admin') ? '/admin/settings' : '/dashboard')}
          >
            Settings
          </DropdownItem>
          <DropdownItem destructive onClick={logout}>
            Logout
          </DropdownItem>
        </Dropdown>
      </div>
    </header>
  );
}
