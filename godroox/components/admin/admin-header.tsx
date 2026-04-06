'use client';

import { Button } from '@/components/ui/button';

interface AdminHeaderProps {
  userName?: string | null;
  onLogout?: () => void;
}

export function AdminHeader({ userName, onLogout }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-secondary-200 bg-white/95 px-6 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-secondary-800">
          Dashboard Godroox
        </h1>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-secondary-600">
          {userName ?? 'Admin'}
        </span>
        {onLogout && (
          <Button variant="outline" size="sm" onClick={onLogout}>
            Sair
          </Button>
        )}
      </div>
    </header>
  );
}
