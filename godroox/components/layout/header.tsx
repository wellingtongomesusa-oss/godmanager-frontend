'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { LanguageSwitcher } from '@/components/language/language-switcher';

const SERVICES_PATHS = ['/seguros-de-vida', '/llc-florida', '/pagamentos-internacionais', '/godroox-mail'];

export function Header() {
  const pathname = usePathname();
  const [isServicesOpen, setIsServicesOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => pathname === path;
  const isServicesActive = SERVICES_PATHS.some((p) => pathname?.startsWith(p));

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsServicesOpen(false);
      }
    }
    if (isServicesOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isServicesOpen]);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-secondary-200 shadow-sm">
      <nav className="container-custom">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3">
            <Logo size="md" />
            <span className="text-xl font-bold text-secondary-900 hidden sm:block">
              Godroox
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              href="/"
              className={`text-sm font-medium transition-colors ${
                isActive('/') ? 'text-primary-600' : 'text-secondary-700 hover:text-primary-600'
              }`}
            >
              Home
            </Link>

            <div
              ref={menuRef}
              className="relative"
              onMouseLeave={() => setIsServicesOpen(false)}
            >
              <button
                type="button"
                onClick={() => setIsServicesOpen((v) => !v)}
                aria-expanded={isServicesOpen}
                aria-haspopup="true"
                className={`text-sm font-medium transition-colors ${
                  isServicesActive ? 'text-primary-600' : 'text-secondary-700 hover:text-primary-600'
                }`}
              >
                Services
              </button>
              {isServicesOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-secondary-200 py-2">
                  <Link
                    href="/seguros-de-vida"
                    className="block px-4 py-2 text-sm text-secondary-700 hover:bg-primary-50 hover:text-primary-600"
                    onClick={() => setIsServicesOpen(false)}
                  >
                    Life Insurance
                  </Link>
                  <Link
                    href="/llc-florida"
                    className="block px-4 py-2 text-sm text-secondary-700 hover:bg-primary-50 hover:text-primary-600"
                    onClick={() => setIsServicesOpen(false)}
                  >
                    Florida LLC Formation
                  </Link>
                  <Link
                    href="/pagamentos-internacionais"
                    className="block px-4 py-2 text-sm text-secondary-700 hover:bg-primary-50 hover:text-primary-600"
                    onClick={() => setIsServicesOpen(false)}
                  >
                    International Payments
                  </Link>
                  <Link
                    href="/godroox-mail"
                    className="block px-4 py-2 text-sm text-secondary-700 hover:bg-primary-50 hover:text-primary-600"
                    onClick={() => setIsServicesOpen(false)}
                  >
                    Godroox Mail
                  </Link>
                </div>
              )}
            </div>

            <Link
              href="/godroox-mail"
              className={`text-sm font-medium transition-colors ${
                isActive('/godroox-mail') ? 'text-primary-600' : 'text-secondary-700 hover:text-primary-600'
              }`}
            >
              Godroox Mail
            </Link>

            <Link
              href="/godroox-pro"
              className={`text-sm font-medium transition-colors px-3 py-1.5 rounded-lg ${
                isActive('/godroox-pro')
                  ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white shadow-lg shadow-primary-500/50'
                  : 'text-secondary-700 hover:text-primary-600 hover:bg-primary-50'
              }`}
            >
              Godroox PRO
            </Link>

            <Link
              href="/contact"
              className={`text-sm font-medium transition-colors ${
                isActive('/contact') ? 'text-primary-600' : 'text-secondary-700 hover:text-primary-600'
              }`}
            >
              Contato
            </Link>
          </div>

          {/* Language Switcher & Auth Buttons */}
          <div className="flex items-center space-x-4">
            <LanguageSwitcher />
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-500/50">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
