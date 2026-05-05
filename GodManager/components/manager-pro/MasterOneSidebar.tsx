'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MASTER_ONE_NAV, isGroup, type NavItem } from '@/lib/manager-pro/masterOneNav';
import type { MasterOneLocale } from '@/lib/manager-pro/masterOneLocale';
import { tMasterOne } from '@/lib/manager-pro/masterOneStrings';

const STORAGE_OPEN = 'master-one-nav-open';

function loadOpenIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(STORAGE_OPEN);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveOpenIds(ids: Set<string>) {
  sessionStorage.setItem(STORAGE_OPEN, JSON.stringify([...ids]));
}

export function MasterOneSidebar({ locale }: { locale: MasterOneLocale }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const stored = loadOpenIds();
    const next = new Set(stored);
    MASTER_ONE_NAV.forEach((item, i) => {
      if (!isGroup(item)) return;
      const hitChild = item.children.some((c) => c.href === pathname);
      const hitParent = item.href === pathname;
      if (hitChild || hitParent) next.add(`nav-${i}`);
    });
    setOpen(next);
  }, [pathname]);

  const toggle = (id: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveOpenIds(next);
      return next;
    });
  };

  return (
    <aside className="gp-sidebar sticky top-14 flex h-[calc(100vh-3.5rem)] w-56 shrink-0 flex-col border-r border-white/10 bg-[#141210] text-white">
      <div className="gp-sidebar-head border-b border-white/10 px-3 py-3">
        <p className="gp-sidebar-head-title text-[11px] font-bold tracking-tight text-white">GodManager.One</p>
        <p className="gp-sidebar-head-sub mt-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/45">
          Navigation
        </p>
      </div>
      <nav className="gp-sidebar-nav flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
        {MASTER_ONE_NAV.map((item, i) => {
          const id = `nav-${i}`;
          return (
            <NavRow
              key={id}
              id={id}
              item={item}
              pathname={pathname}
              locale={locale}
              open={open}
              onToggle={toggle}
            />
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-2">
        <div className="my-2 border-t border-dashed border-white/20" />
        <Link
          href="/"
          className="block rounded-lg px-3 py-2 text-center text-xs font-medium text-[var(--amber)] hover:bg-white/10"
        >
          {tMasterOne(locale, 'nav.backSite')}
        </Link>
      </div>
    </aside>
  );
}

function NavRow({
  id,
  item,
  pathname,
  locale,
  open,
  onToggle,
}: {
  id: string;
  item: NavItem;
  pathname: string;
  locale: MasterOneLocale;
  open: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (!isGroup(item)) {
    const label = tMasterOne(locale, item.labelKey);
    const active = pathname === item.href;
    const sub = item.subtitleKey ? tMasterOne(locale, item.subtitleKey) : null;
    const leafTarget = item.target === '_blank' ? '_blank' : undefined;
    const leafRel = item.target === '_blank' ? 'noopener noreferrer' : undefined;
    return (
      <Link
        href={item.href}
        target={leafTarget}
        rel={leafRel}
        className={`group block rounded-lg px-3 py-2 text-xs font-medium transition ${
          active ? 'bg-[var(--amber)] text-white' : 'text-white/80 hover:bg-white/10'
        }`}
      >
        <span className={`block ${sub ? 'font-bold tracking-wide' : ''}`}>{label}</span>
        {sub && (
          <span className="mt-1 block text-[9px] font-normal leading-snug text-white/55 group-hover:text-white/70">
            {sub}
          </span>
        )}
      </Link>
    );
  }

  const hasChildren = item.children.length > 0;
  const label = tMasterOne(locale, item.labelKey);
  const expanded = open.has(id);

  return (
    <div>
      <div className="flex items-center gap-0.5">
        {item.href ? (
          <Link
            href={item.href}
            className={`min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-xs font-medium transition ${
              pathname === item.href ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10'
            }`}
          >
            {label}
          </Link>
        ) : (
          <span className="flex-1 truncate px-3 py-2 text-xs font-medium text-white/80">{label}</span>
        )}
        {hasChildren && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => onToggle(id)}
            className="shrink-0 rounded px-2 py-2 text-[10px] text-white/60 hover:bg-white/10"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? '▼' : '▶'}
          </button>
        )}
      </div>
      {hasChildren && expanded && (
        <div className="ml-2 mt-0.5 space-y-0.5 border-l border-white/15 pl-2">
          {item.children.map((child) => {
            const cl = tMasterOne(locale, child.labelKey);
            const active = pathname === child.href && child.target !== '_blank';
            const childTarget = child.target === '_blank' ? '_blank' : undefined;
            const childRel = child.target === '_blank' ? 'noopener noreferrer' : undefined;
            return (
              <Link
                key={child.href}
                href={child.href}
                target={childTarget}
                rel={childRel}
                className={`block rounded-lg px-2 py-1.5 text-[11px] transition ${
                  active ? 'bg-[var(--amber)]/90 text-white' : 'text-white/65 hover:bg-white/10 hover:text-white'
                }`}
              >
                {cl}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
