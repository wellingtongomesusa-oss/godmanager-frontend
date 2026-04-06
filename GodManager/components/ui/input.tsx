import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, error, ...props }, ref) => (
  <div className="w-full">
    <input
      ref={ref}
      className={cn(
        'w-full rounded-[7px] border border-gm-border-strong bg-gm-sand px-4 py-3 text-[13px] text-gm-ink placeholder:text-gm-ink-tertiary/80 transition-all duration-150',
        'focus:border-gm-amber focus:outline-none focus:ring-[3px] focus:ring-gm-amber/20',
        error && 'border-gm-red focus:ring-gm-red/20',
        className,
      )}
      {...props}
    />
    {error ? <p className="mt-1.5 text-xs text-gm-red">{error}</p> : null}
  </div>
));
Input.displayName = 'Input';
