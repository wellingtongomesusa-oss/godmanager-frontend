import Link from 'next/link';
import { cn } from '@/lib/utils';

export function GodManagerLogo({
  size = 'md',
  surface = 'light',
  /** Tipografia Playfair + Inter (ex.: card /login) */
  loginBrand = false,
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  surface?: 'light' | 'dark';
  loginBrand?: boolean;
  className?: string;
}) {
  const iconSz =
    size === 'lg' ? 'h-11 w-11 text-xl' : size === 'sm' ? 'h-8 w-8 text-base' : 'h-9 w-9 text-lg';
  const titleCls =
    loginBrand && surface === 'light'
      ? 'text-login-navy'
      : surface === 'dark'
        ? 'text-white'
        : 'text-gm-ink';
  const subCls =
    loginBrand
      ? 'text-login-gold'
      : surface === 'dark'
        ? 'text-gm-amber/90'
        : 'text-gm-amber';

  const serifFont = loginBrand ? 'font-playfair' : 'font-heading';
  const subFont = loginBrand ? 'font-inter tracking-[0.28em]' : '';

  return (
    <Link
      href="/dashboard"
      className={cn(
        'flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        loginBrand ? 'focus-visible:ring-login-gold' : 'focus-visible:ring-gm-amber',
        surface === 'light'
          ? loginBrand
            ? 'focus-visible:ring-offset-login-cream'
            : 'focus-visible:ring-offset-gm-sand'
          : 'focus-visible:ring-offset-gm-sidebar',
        className,
      )}
    >
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#dfc08a] to-[#C9A961] font-semibold text-white shadow-gm-amber',
          serifFont,
          iconSz,
        )}
        aria-hidden
      >
        G
      </div>
      <div className="leading-tight">
        <span className={cn('block text-lg font-semibold tracking-tight', serifFont, titleCls)}>GodManager</span>
        <span className={cn('text-[9px] font-semibold uppercase tracking-[0.2em]', subFont, subCls)}>
          Financial Operations
        </span>
      </div>
    </Link>
  );
}
