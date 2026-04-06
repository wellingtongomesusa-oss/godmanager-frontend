import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ className, size = 'md' }: LogoProps) {
  const sizes = { sm: 'h-8 min-w-[2rem]', md: 'h-10 min-w-[2.5rem]', lg: 'h-12 min-w-[3rem]' };
  const textSizes = { sm: 'text-xs font-bold', md: 'text-sm font-bold', lg: 'text-base font-bold' };
  return (
    <div
      role="img"
      title="GodCRM"
      aria-label="GodCRM"
      className={cn(
        'flex items-center justify-center rounded-lg bg-primary-600 px-2 text-white shadow-lg shadow-primary-500/50',
        sizes[size],
        className
      )}
    >
      <span className={cn('tracking-tight', textSizes[size])}>GodCRM</span>
    </div>
  );
}
