'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';

const PRODUTOS: { slug: string; label: string }[] = [
  { slug: '', label: 'Visão geral' },
  { slug: 'life_insurance', label: 'Life Insurance' },
  { slug: 'llc_florida', label: 'LLC Flórida' },
  { slug: 'pagamentos_internacionais', label: 'Pag. Internacionais' },
  { slug: 'godroox_pro', label: 'Godroox PRO' },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const produtoAtual = searchParams.get('produto') ?? '';

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-white/10 bg-brand-dark backdrop-blur-sm">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-6">
          <Logo size="sm" />
          <span className="text-lg font-semibold text-white">
            Dashboard Godroox
          </span>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-4">
          <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-brand-muted">
            Produtos
          </p>
          {PRODUTOS.map((item) => {
            const href = item.slug ? `/dashboard?produto=${item.slug}` : '/dashboard';
            const isActive = item.slug ? produtoAtual === item.slug : !produtoAtual;
            return (
              <Link
                key={item.slug || 'todos'}
                href={href}
                className={cn(
                  'flex items-center rounded-lg px-4 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'text-brand-muted hover:bg-white/5 hover:text-white'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4">
          <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-brand-muted">
            Contato Godroox
          </p>
          <div className="space-y-2 px-3 text-sm text-brand-muted">
            <a
              href="mailto:contact@godroox.com"
              className="block truncate text-primary-400 hover:text-primary-300 hover:underline"
              title="E-mail oficial"
            >
              contact@godroox.com
            </a>
            <a
              href="https://wa.me/13215194710"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-primary-400 hover:text-primary-300 hover:underline"
              title="WhatsApp oficial"
            >
              +1 (321) 519-4710
            </a>
          </div>
        </div>
      </div>
    </aside>
  );
}
