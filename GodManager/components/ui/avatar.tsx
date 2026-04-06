import { cn } from '@/lib/utils';

function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

const colors = [
  'bg-gm-amber-bg text-gm-amber',
  'bg-gm-blue-bg text-gm-blue',
  'bg-purple-100 text-purple-800',
  'bg-teal-100 text-teal-800',
];

export function Avatar({
  firstName,
  lastName,
  size = 'md',
  className,
  variant = 'default',
}: {
  firstName: string;
  lastName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  variant?: 'default' | 'sidebar';
}) {
  const hash = (firstName + lastName).length % colors.length;
  const sz = size === 'sm' ? 'h-8 w-8 text-xs' : size === 'lg' ? 'h-20 w-20 text-xl' : 'h-10 w-10 text-sm';
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold',
        variant === 'sidebar'
          ? 'bg-gm-amber/20 text-gm-amber ring-2 ring-gm-amber'
          : cn('ring-2 ring-gm-amber/50', colors[hash]),
        sz,
        className,
      )}
      aria-hidden
    >
      {initials(firstName, lastName)}
    </div>
  );
}
