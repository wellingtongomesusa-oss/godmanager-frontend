'use client';

import { cn } from '@/lib/utils';

export function Logo({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-8 w-8 text-base', md: 'h-10 w-10 text-lg', lg: 'h-12 w-12 text-xl' };
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-brex bg-primary-500 text-white font-semibold shadow-brex-sm',
        sizes[size],
        className
      )}
    >
      G
    </div>
  );
}
