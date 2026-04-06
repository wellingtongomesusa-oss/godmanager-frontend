'use client';

import Link from 'next/link';

const MAX_WIDTH = 1200;

export function InvoiceNav() {
  return (
    <nav
      className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur"
      role="navigation"
      aria-label="Main navigation"
    >
      <div
        className="mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8"
        style={{ maxWidth: MAX_WIDTH }}
      >
        <Link
          href="/"
          className="flex items-center gap-2 text-invoice-heading font-semibold no-underline transition-opacity duration-300 hover:opacity-90"
          aria-label="Home - Invoice tool"
        >
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
            style={{ background: 'var(--invoice-primary)' }}
            aria-hidden
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <path d="M10 9H8v2h2V9zm4 0h-2v2h2V9z" />
            </svg>
          </span>
          <span className="text-lg">Invoice</span>
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          <Link href="#products" className="text-sm text-invoice-body transition-colors duration-300 hover:text-invoice-heading">Products</Link>
          <Link href="#pricing" className="text-sm text-invoice-body transition-colors duration-300 hover:text-invoice-heading">Pricing</Link>
          <Link href="#resources" className="text-sm text-invoice-body transition-colors duration-300 hover:text-invoice-heading">Resources</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/painel"
            className="rounded-lg px-4 py-2 text-sm font-medium text-invoice-body transition-colors duration-300 hover:text-invoice-heading"
          >
            Login
          </Link>
          <Link
            href="/get-started"
            className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:opacity-95 focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ background: 'var(--invoice-primary)' }}
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}
