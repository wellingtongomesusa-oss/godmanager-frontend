import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-gm-pulse rounded-lg bg-gm-cream/90', className)}
      aria-hidden
    />
  );
}
