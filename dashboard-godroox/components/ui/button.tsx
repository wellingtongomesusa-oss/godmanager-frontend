'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center rounded-lg font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
    const variants = {
      primary: 'bg-primary-500 text-white hover:bg-primary-600',
      secondary: 'border border-brand-charcoal bg-brand-charcoal text-white hover:bg-[#2a2a2a]',
      outline: 'border-2 border-gray-400 bg-transparent text-white hover:bg-white/10',
      ghost: 'text-secondary-700 hover:bg-gray-100',
      danger: 'bg-danger-500 text-white hover:bg-danger-600',
    };
    const sizes = { sm: 'h-9 px-4 text-sm', md: 'h-11 px-6 text-base', lg: 'h-12 px-8 text-lg' };
    return (
      <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} {...props}>
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
export { Button };
