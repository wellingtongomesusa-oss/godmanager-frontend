'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/language-context';
import { usePlan } from '@/contexts/plan-context';
import { PLAN_NAMES } from '@/lib/plans';
import { exportDashboardCsv, exportDashboardPdf } from '@/lib/dashboard-export';
import { cn } from '@/lib/utils';

interface AdminHeaderProps {
  userName?: string | null;
  onMenuToggle?: () => void;
}

export function AdminHeader({ userName, onMenuToggle }: AdminHeaderProps) {
  const { t } = useLanguage();
  const { plan, setPlan, isPlan3 } = usePlan();
  const [exportOpen, setExportOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setExportOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-secondary-200 bg-white shadow-sm">
      <div className="flex flex-col">
        {/* Plan bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-secondary-100 bg-primary-50/50 px-4 py-2.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium text-secondary-800">
              {t('header.planCurrent')}: <span className="text-primary-700">{PLAN_NAMES[plan]}</span>
            </p>
            <select
              value={plan}
              onChange={(e) => setPlan(Number(e.target.value) as 1 | 2 | 3)}
              className="rounded-lg border border-secondary-300 bg-white px-3 py-1.5 text-sm text-secondary-800 shadow-sm"
              aria-label="Alterar plano"
            >
              <option value={1}>Plano 1</option>
              <option value={2}>Plano 2</option>
              <option value={3}>Plano 3</option>
            </select>
            {!isPlan3 && (
              <Button
                type="button"
                size="sm"
                className="shrink-0 bg-primary-600 font-semibold text-white shadow-md hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                onClick={() => setPlan(3)}
              >
                {t('header.upgrade')}
              </Button>
            )}
          </div>
          {isPlan3 && (
            <p className="text-sm font-medium text-success-700">
              {t('header.planDiscount')}
            </p>
          )}
        </div>
        {/* Main header */}
        <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            {onMenuToggle && (
              <button
                type="button"
                onClick={onMenuToggle}
                className="lg:hidden p-2 -ml-2 rounded-lg text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100 transition-colors"
                aria-label="Abrir menu"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
            <h1 className="text-base sm:text-lg font-semibold text-secondary-800 truncate">{t('header.title')}</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="relative" ref={dropdownRef}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setExportOpen((o) => !o)}
                aria-expanded={exportOpen}
                aria-haspopup="true"
              >
                {t('gaap.export')} ▾
              </Button>
              {exportOpen && (
                <div
                  className={cn(
                    'absolute right-0 top-full z-50 mt-1.5 min-w-[180px] rounded-xl border border-secondary-200 bg-white py-1 shadow-lg'
                  )}
                  role="menu"
                >
                  <button
                    type="button"
                    className="w-full px-4 py-2.5 text-left text-sm text-secondary-800 hover:bg-secondary-50 transition-colors"
                    role="menuitem"
                    onClick={() => { exportDashboardCsv(); setExportOpen(false); }}
                  >
                    {t('gaap.exportCsv')}
                  </button>
                  <button
                    type="button"
                    className="w-full px-4 py-2.5 text-left text-sm text-secondary-800 hover:bg-secondary-50 transition-colors"
                    role="menuitem"
                    onClick={() => { exportDashboardPdf(); setExportOpen(false); }}
                  >
                    {t('gaap.exportPdf')}
                  </button>
                </div>
              )}
            </div>
            <span className="text-sm font-medium text-secondary-700">{userName ?? 'Admin'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
