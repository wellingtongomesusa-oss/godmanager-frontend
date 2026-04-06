'use client';

import { Button } from '@/components/ui/button';

interface AdminHeaderProps {
  userName?: string | null;
  onLogout?: () => void;
  onMenuToggle?: () => void;
}

export function AdminHeader({ userName, onLogout, onMenuToggle }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-secondary-200/80 bg-white/95 backdrop-blur-sm px-4 sm:px-6 shadow-brex-sm">
      <div className="flex items-center gap-3 min-w-0">
        {onMenuToggle && (
          <button
            type="button"
            onClick={onMenuToggle}
            className="lg:hidden p-2 -ml-2 rounded-brex text-secondary-500 hover:text-brex-black hover:bg-secondary-100 transition-colors"
            aria-label="Abrir menu"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <h1 className="text-base font-semibold text-brex-black truncate">Dashboard Godroox</h1>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="hidden sm:inline text-sm text-secondary-500 truncate max-w-[140px] md:max-w-none">{userName ?? 'Admin'}</span>
        {onLogout && (
          <Button
            variant="outline"
            size="sm"
            onClick={onLogout}
            className="border-secondary-200 text-secondary-700 bg-white hover:bg-secondary-50 hover:border-secondary-300 text-sm font-medium"
          >
            Sair
          </Button>
        )}
      </div>
    </header>
  );
}
