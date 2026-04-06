'use client';

import Link from 'next/link';

export function LandingHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-secondary-200/60 bg-white/90 backdrop-blur-sm">
      <div className="container-custom flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2" aria-label="Godroox Pro">
          <span className="flex h-7 w-7 shrink-0 rounded-md bg-primary-400" aria-hidden />
          <span className="text-base font-medium tracking-tight text-secondary-800">Godroox Pro</span>
        </Link>
        <nav className="hidden items-center gap-6 sm:flex" aria-label="Navegação">
          <Link href="#como-funciona" className="text-sm text-secondary-500 hover:text-secondary-700 transition-colors">
            Como funciona
          </Link>
          <Link href="#precos" className="text-sm text-secondary-500 hover:text-secondary-700 transition-colors">
            Preços
          </Link>
          <Link href="#faq" className="text-sm text-secondary-500 hover:text-secondary-700 transition-colors">
            FAQ
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/admin/painel" className="inline-flex h-9 items-center justify-center rounded-lg border-2 border-primary-500 px-4 text-sm font-semibold text-primary-600 hover:bg-primary-50">
            Entrar
          </Link>
          <Link href="#acesso" className="inline-flex h-9 items-center justify-center rounded-lg bg-primary-500 px-4 text-sm font-semibold text-white hover:bg-primary-600">
            Começar grátis
          </Link>
        </div>
      </div>
    </header>
  );
}
