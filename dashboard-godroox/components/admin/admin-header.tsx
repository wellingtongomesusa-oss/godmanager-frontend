'use client';

import { Button } from '@/components/ui/button';

interface AdminHeaderProps {
  userName?: string | null;
  onLogout?: () => void;
}

export function AdminHeader({ userName, onLogout }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-brand-dark px-6 backdrop-blur-sm">
      <h1 className="text-lg font-semibold text-white">Dashboard Godroox</h1>
      <div className="flex items-center gap-4">
        <span className="text-sm text-brand-muted">{userName ?? 'Admin'}</span>
        {onLogout && (
          <Button
            variant="outline"
            size="sm"
            onClick={onLogout}
            className="border-white/20 bg-transparent text-white hover:bg-white/10"
          >
            Sair
          </Button>
        )}
      </div>
    </header>
  );
}
