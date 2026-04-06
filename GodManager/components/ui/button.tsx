import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'md' | 'lg' | 'sm';
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', disabled, type = 'button', ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center font-semibold transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gm-amber focus-visible:ring-offset-2 focus-visible:ring-offset-gm-sand disabled:pointer-events-none disabled:opacity-45';
    const sizes = {
      sm: 'rounded-lg px-3 py-1.5 text-[11.5px]',
      md: 'rounded-lg px-6 py-3 text-sm',
      lg: 'min-h-[48px] w-full rounded-lg px-6 py-3 text-sm',
    };
    const variants = {
      primary:
        'bg-gm-amber text-white shadow-gm-amber hover:bg-gm-amber-light active:scale-[0.99]',
      secondary: 'border border-gm-border-strong bg-gm-cream text-gm-ink-secondary hover:border-gm-amber hover:text-gm-ink',
      outline:
        'border border-gm-border-strong bg-transparent text-gm-ink-secondary hover:border-gm-amber hover:text-gm-amber',
      danger: 'bg-gm-red text-white hover:opacity-90',
      ghost: 'text-gm-ink-secondary hover:bg-gm-amber-bg hover:text-gm-amber',
    };
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={cn(base, sizes[size], variants[variant], className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
