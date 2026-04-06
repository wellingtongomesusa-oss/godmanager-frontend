import { cn } from '@/lib/utils';

const variants = {
  admin: 'bg-gm-amber-bg text-gm-amber border border-gm-amber/35',
  manager: 'bg-gm-blue-bg text-gm-blue border border-gm-blue/25',
  accountant: 'bg-purple-100 text-purple-800 border border-purple-200',
  leasing: 'bg-teal-100 text-teal-800 border border-teal-200',
  maintenance: 'bg-orange-100 text-orange-800 border border-orange-200',
  viewer: 'bg-gm-slate-bg text-gm-slate border border-gm-border',
  active: 'bg-gm-green-bg text-gm-green border border-gm-green/30',
  suspended: 'bg-gm-red-bg text-gm-red border border-gm-red/30',
  pending: 'bg-gm-amber-bg text-gm-amber border border-gm-amber/30',
};

export function Badge({
  children,
  variant,
  className,
}: {
  children: React.ReactNode;
  variant: keyof typeof variants;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[20px] px-[9px] py-[3px] text-[10px] font-semibold uppercase tracking-wide',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
