import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ className, size = 'md' }: LogoProps) {
  const sizes = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-lg bg-primary-600 text-white font-bold shadow-lg shadow-primary-500/50',
        sizes[size],
        className
      )}
    >
      <span className={textSizes[size]}>G</span>
    </div>
  );
}
