'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/language-context';
import { usePlan } from '@/contexts/plan-context';
import { getMenuPermissions, type MenuPermissions } from '@/services/permission.service';
import { GODROOX_MENU_ITEM } from '@/lib/menu-config';
import { CalcFinanceiraModal } from './calc-financeira-modal';
import { AddDepartmentModal } from './add-department-modal';
import type { Department } from '@/services/departments.service';

function getGodrooxUrl(): string {
  if (typeof window !== 'undefined') {
    return (process.env.NEXT_PUBLIC_GODROOX_DASHBOARD_URL as string) || 'http://localhost:3001';
  }
  return (process.env.NEXT_PUBLIC_GODROOX_DASHBOARD_URL as string) || 'http://localhost:3001';
}

interface AdminSidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function AdminSidebar({ open = false, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const { t, language, setLanguage } = useLanguage();
  const { plan } = usePlan();
  const [calcOpen, setCalcOpen] = useState(false);
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [cadastroDropdownOpen, setCadastroDropdownOpen] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptLoading, setDeptLoading] = useState(false);

  const permissions: MenuPermissions = getMenuPermissions(plan);
  const menuItems = [...permissions.items, GODROOX_MENU_ITEM];
  const showCalc = plan >= 2;

  const fetchDepartments = () => {
    setDeptLoading(true);
    fetch('/api/departamentos')
      .then((res) => res.json())
      .then((data) => setDepartments(data.departamentos ?? []))
      .catch(() => setDepartments([]))
      .finally(() => setDeptLoading(false));
  };

  useEffect(() => {
    if (plan >= 3) fetchDepartments();
  }, [plan]);

  const isActive = (item: { href?: string; matchPrefix?: string }, extraPath?: string) => {
    if (extraPath && pathname.startsWith(extraPath)) return true;
    if (!item.href && !item.matchPrefix) return false;
    const path = (item.href || item.matchPrefix || '').split('#')[0];
    if (pathname === path) return true;
    if (path === '/admin/painel' && (pathname === '/admin/painel' || pathname === '/admin/dashboard')) return true;
    if (path === '/admin/cadastro' && pathname === '/admin/cadastro') return true;
    if (item.matchPrefix && pathname.startsWith(item.matchPrefix)) return true;
    return false;
  };

  const cadastroItem = menuItems.find((m) => m.key === 'cadastro');
  const showCadastroDropdown = plan >= 3 && permissions.canAccessCadastroDropdown && cadastroItem;

  return (
    <>
      {open && onClose && (
        <button
          type="button"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-label="Fechar menu"
        />
      )}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen w-64 max-w-[85vw] sm:max-w-xs flex-col border-r border-secondary-200 bg-white shadow-lg shadow-secondary-200/30 transition-transform duration-200 ease-out lg:translate-x-0 lg:max-w-none',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-14 sm:h-16 shrink-0 items-center justify-between gap-3 border-b border-secondary-200 bg-secondary-50/90 px-4 sm:px-5">
            <div className="flex items-center gap-3 min-w-0">
              <Logo size="sm" />
              <span className="text-base sm:text-lg font-semibold text-secondary-900 truncate">{t('header.title')}</span>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="lg:hidden p-2 rounded-lg text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100"
                aria-label="Fechar menu"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <nav className="flex-1 space-y-0.5 overflow-y-auto p-4">
            {menuItems.map((item) => {
              if (item.key === 'cadastro' && showCadastroDropdown) {
                return (
                  <div key="cadastro-dropdown" className="relative">
                    <button
                      type="button"
                      onClick={() => setCadastroDropdownOpen((v) => !v)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors',
                        isActive(item) || pathname.startsWith('/admin/departamentos')
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-secondary-700 hover:bg-secondary-100 hover:text-secondary-900'
                      )}
                    >
                      {t(item.labelKey)}
                      <svg
                        className={cn('h-4 w-4 transition-transform', cadastroDropdownOpen && 'rotate-180')}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {cadastroDropdownOpen && (
                      <div className="mt-1 ml-2 space-y-0.5 border-l-2 border-secondary-200 pl-2">
                        {deptLoading ? (
                          <p className="px-2 py-1 text-xs text-secondary-500">{t('common.loading')}</p>
                        ) : departments.length === 0 ? (
                          <p className="px-2 py-1 text-xs text-secondary-500">{t('dept.empty')}</p>
                        ) : (
                          departments.map((d) => (
                            <Link
                              key={d.id}
                              href={`/admin/departamentos/${d.id}`}
                              onClick={onClose}
                              className={cn(
                                'block rounded-lg px-2 py-2 text-sm font-medium transition-colors no-underline',
                                pathname === `/admin/departamentos/${d.id}`
                                  ? 'bg-primary-50 text-primary-700'
                                  : 'text-secondary-600 hover:bg-secondary-100 hover:text-secondary-900'
                              )}
                            >
                              {d.name}
                            </Link>
                          ))
                        )}
                        {permissions.canCreateDepartments && (
                          <button
                            type="button"
                            onClick={() => {
                              setCadastroDropdownOpen(false);
                              setDeptModalOpen(true);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-primary-600 transition-colors hover:bg-primary-50"
                          >
                            <span className="text-primary-600">+</span>
                            {t('sidebar.addDepartment')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              }
              if (item.type === 'action') {
                if (item.key === 'calc' && !showCalc) return null;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => item.key === 'calc' && setCalcOpen(true)}
                    className="flex w-full items-center rounded-lg px-4 py-3 text-left text-sm font-medium text-secondary-700 transition-colors hover:bg-secondary-100 hover:text-secondary-900"
                  >
                    {t(item.labelKey)}
                  </button>
                );
              }
              if (item.type === 'external' || item.external) {
                const url = item.key === 'godroox' ? getGodrooxUrl() : (item.href ?? '#');
                return (
                  <a
                    key={item.key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg px-4 py-3 text-sm font-medium text-secondary-700 no-underline transition-colors hover:bg-secondary-100 hover:text-secondary-900"
                  >
                    {t(item.labelKey)}
                  </a>
                );
              }
              if (!item.href) return null;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'block rounded-lg px-4 py-3 text-sm font-medium transition-colors no-underline',
                    isActive(item) ? 'bg-primary-50 text-primary-700' : 'text-secondary-700 hover:bg-secondary-100 hover:text-secondary-900'
                  )}
                >
                  {t(item.labelKey)}
                </Link>
              );
            })}
            <div className="border-t border-secondary-200 pt-4 mt-1">
              <p className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-secondary-500">{t('sidebar.idioma')}</p>
              <div className="flex gap-2 px-4">
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                    language === 'en' ? 'border-primary-500 bg-primary-600 text-white' : 'border-secondary-300 bg-white text-secondary-600 hover:bg-secondary-100'
                  )}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('pt')}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                    language === 'pt' ? 'border-primary-500 bg-primary-600 text-white' : 'border-secondary-300 bg-white text-secondary-600 hover:bg-secondary-100'
                  )}
                >
                  PT
                </button>
              </div>
            </div>
          </nav>
        </div>
      </aside>
      <CalcFinanceiraModal open={calcOpen} onClose={() => setCalcOpen(false)} />
      <AddDepartmentModal
        open={deptModalOpen}
        onClose={() => setDeptModalOpen(false)}
        onSuccess={fetchDepartments}
      />
    </>
  );
}
