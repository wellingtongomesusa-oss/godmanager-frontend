'use client';

interface FinancialHeaderProps {
  userName?: string;
  onLogout?: () => void;
}

export function FinancialHeader({ userName, onLogout }: FinancialHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-secondary-200 bg-white/95 px-6 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-secondary-900">
          Financial Dashboard
        </h1>
        <span className="rounded-full bg-success-100 px-2.5 py-0.5 text-xs font-medium text-success-700">
          SOX 404 Compliant
        </span>
      </div>
      <div className="flex items-center gap-4">
        {userName && (
          <span className="text-sm text-secondary-600">{userName}</span>
        )}
        {onLogout && (
          <button
            onClick={onLogout}
            className="text-sm font-medium text-secondary-600 hover:text-secondary-900"
          >
            Sair
          </button>
        )}
      </div>
    </header>
  );
}
