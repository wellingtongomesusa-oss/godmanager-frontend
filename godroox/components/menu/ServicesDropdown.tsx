'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n';

export interface ServiceLink {
  href: string;
  labelKey: string;
}

export const SERVICES_LINKS: ServiceLink[] = [
  { href: '/seguros-de-vida', labelKey: 'services.lifeInsurance' },
  { href: '/llc-florida', labelKey: 'services.floridaLLC' },
  { href: '/pagamentos-internacionais', labelKey: 'services.internationalPayments' },
  { href: '/godroox-mail', labelKey: 'services.godrooxMail' },
  { href: '/godroox-pro', labelKey: 'services.godrooxPro' },
  { href: '/criar-invoice', labelKey: 'services.criarInvoice' },
  { href: '/request-service', labelKey: 'services.requestService' },
  { href: '/parceiros', labelKey: 'services.parceiros' },
];

export const SERVICES_PATHS = [
  '/seguros-de-vida',
  '/llc-florida',
  '/pagamentos-internacionais',
  '/godroox-mail',
  '/godroox-pro',
  '/criar-invoice',
  '/request-service',
  '/parceiros',
];

interface ServicesDropdownProps {
  isActive: boolean;
  className?: string;
}

/**
 * Menu Serviços: trigger + submenu (ul/li).
 * - Estado open controlado internamente; classe "open" no container quando aberto.
 * - Clique no trigger alterna open; clique fora fecha (listener global).
 * - Acessibilidade: aria-expanded, aria-haspopup, role="menu".
 */
export function ServicesDropdown({ isActive, className = '' }: ServicesDropdownProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen((prev) => !prev);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (!open || !containerRef.current) return;
      if (containerRef.current.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener('click', handleClickOutside, true);
    return () => document.removeEventListener('click', handleClickOutside, true);
  }, [open]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-visible ${open ? 'open' : ''} ${className}`}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="services-menu"
        id="services-trigger"
        className={`flex items-center gap-1 text-sm font-medium transition-colors ${
          isActive ? 'text-primary-600' : 'text-secondary-700 hover:text-primary-600'
        }`}
      >
        {t('nav.services')}
        <svg
          className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div
        id="services-menu"
        role="menu"
        aria-labelledby="services-trigger"
        className={`absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-secondary-200 py-2 z-[9998] transition-all duration-200 ${
          open
            ? 'opacity-100 visible translate-y-0'
            : 'opacity-0 invisible -translate-y-2 pointer-events-none'
        }`}
      >
        <ul className="list-none p-0 m-0">
          {SERVICES_LINKS.map(({ href, labelKey }) => (
            <li key={href} role="none">
              <Link
                href={href}
                role="menuitem"
                className="block px-4 py-2.5 text-sm text-secondary-700 hover:bg-primary-50 hover:text-primary-600 transition-colors"
                onClick={close}
              >
                {t(labelKey)}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
