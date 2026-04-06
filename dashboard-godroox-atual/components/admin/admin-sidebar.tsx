'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';

function getGodcrmUrl(): string {
  if (typeof window !== 'undefined') {
    return (process.env.NEXT_PUBLIC_GODCRM_DASHBOARD_URL as string) || 'http://localhost:3000';
  }
  return (process.env.NEXT_PUBLIC_GODCRM_DASHBOARD_URL as string) || 'http://localhost:3000';
}

const PRODUTOS: { slug: string; label: string }[] = [
  { slug: '', label: 'Visão geral' },
  { slug: 'life_insurance', label: 'Life Insurance' },
  { slug: 'llc_florida', label: 'LLC Flórida' },
  { slug: 'pagamentos_internacionais', label: 'Pag. Internacionais' },
  { slug: 'godroox_pro', label: 'Godroox PRO' },
];

interface AdminSidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function AdminSidebar({ open = false, onClose }: AdminSidebarProps) {
  const searchParams = useSearchParams();
  const produtoAtual = searchParams.get('produto') ?? '';

  return (
    <>
      {open && (
        <button
          type="button"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-brex-black/20 backdrop-blur-sm lg:hidden"
          aria-label="Fechar menu"
        />
      )}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-secondary-200/80 bg-white shadow-brex transition-transform duration-200 ease-out',
          'lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-secondary-200/80 px-5">
          <div className="flex items-center gap-3 min-w-0">
            <Logo size="sm" />
            <span className="text-base font-semibold text-brex-black truncate">Dashboard Godroox</span>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-2 rounded-brex text-secondary-500 hover:text-brex-black hover:bg-secondary-100 transition-colors"
              aria-label="Fechar menu"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-secondary-400">
            Produtos
          </p>
          <div className="space-y-0.5">
            {PRODUTOS.map((item) => {
              const href = item.slug ? `/dashboard?produto=${item.slug}` : '/dashboard';
              const isActive = item.slug ? produtoAtual === item.slug : !produtoAtual;
              return (
                <Link
                  key={item.slug || 'todos'}
                  href={href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center rounded-brex px-3 py-2.5 text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-primary-50 text-primary-600'
                      : 'text-secondary-600 hover:bg-secondary-50 hover:text-brex-black'
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <div className="my-4 border-t border-secondary-200/80" />
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-secondary-400">
            Ferramentas
          </p>
          <Link
            href="/dashboard/chat"
            onClick={onClose}
            className="flex items-center gap-2.5 rounded-brex px-3 py-2.5 text-sm font-medium text-secondary-600 transition-all duration-150 hover:bg-secondary-50 hover:text-primary-600"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            Grok AI Chat
          </Link>
          <div className="my-4 border-t border-secondary-200/80" />
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-secondary-400">
            Acesso
          </p>
          <a
            href={getGodcrmUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-brex px-3 py-2.5 text-sm font-medium text-secondary-600 transition-all duration-150 hover:bg-secondary-50 hover:text-primary-600"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
            Ver GodCRM
          </a>
        </nav>
        <div className="shrink-0 border-t border-secondary-200/80 bg-secondary-50/50 p-4">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-secondary-400">
            Contato Godroox
          </p>
          <div className="space-y-2 px-3 text-sm">
            <a
              href="mailto:contact@godroox.com"
              className="block truncate text-primary-600 hover:text-primary-700 transition-colors"
              title="E-mail oficial"
            >
              contact@godroox.com
            </a>
            <a
              href="https://wa.me/13215194710"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-primary-600 hover:text-primary-700 transition-colors"
              title="WhatsApp oficial"
            >
              +1 (321) 519-4710
            </a>
          </div>
        </div>
      </aside>
    </>
  );
}
