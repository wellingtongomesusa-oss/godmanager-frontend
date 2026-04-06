'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Dropdown({
  trigger,
  children,
  align = 'right',
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-gm-amber"
      >
        {trigger}
        <ChevronDown className={cn('h-4 w-4 text-gm-ink-secondary transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <div
          role="menu"
          className={cn(
            'absolute top-full z-50 mt-2 min-w-[200px] rounded-xl border border-gm-border bg-gm-paper py-1 shadow-gm-card',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function DropdownItem({
  children,
  onClick,
  destructive,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center px-4 py-2.5 text-left text-sm transition-colors hover:bg-gm-amber-bg',
        destructive ? 'text-gm-red hover:text-gm-red' : 'text-gm-ink',
      )}
    >
      {children}
    </button>
  );
}
