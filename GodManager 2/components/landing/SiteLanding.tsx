'use client';

import Link from 'next/link';
import { Cormorant_Garamond, DM_Sans } from 'next/font/google';
import { TrustKpiPanel } from './TrustKpiPanel';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans-landing',
  display: 'swap',
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-cormorant',
  display: 'swap',
});

export function SiteLanding() {
  return (
    <div className={`${dmSans.variable} ${cormorant.variable} min-h-screen bg-[var(--coal)] text-[var(--warm-white)]`}>
      <header className="border-b border-[color-mix(in_srgb,var(--champagne)_20%,transparent)] px-4 py-5 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <p className="font-[family-name:var(--font-dm-sans-landing)] text-sm font-semibold tracking-tight">
            GodManager<span className="text-[var(--champagne)]">.One</span>
          </p>
          <Link
            href="/manager-pro"
            className="rounded-xl bg-[var(--champagne)] px-5 py-2.5 text-sm font-semibold text-[var(--coal)] transition hover:opacity-95"
            style={{ fontFamily: 'var(--font-dm-sans-landing), system-ui, sans-serif' }}
          >
            Abrir painel
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden px-4 pb-12 pt-16 sm:px-8 sm:pb-16 sm:pt-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_color-mix(in_srgb,var(--champagne)_22%,transparent),_transparent_55%)]" />
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--champagne)]">Suite imobiliária</p>
          <h1
            className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl"
            style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}
          >
            GodManager Trust
          </h1>
          <p
            className="mx-auto mt-4 max-w-xl text-base text-[color-mix(in_srgb,white_78%,var(--coal))]"
            style={{ fontFamily: 'var(--font-dm-sans-landing), system-ui, sans-serif' }}
          >
            Gestão de unidades de longo prazo, rent roll e integrações financeiras — mesma identidade visual             champagne e coal em todo o site.
          </p>
        </div>
      </section>

      <TrustKpiPanel />

      <footer className="border-t border-[color-mix(in_srgb,var(--champagne)_15%,transparent)] px-4 py-8 text-center text-xs text-[color-mix(in_srgb,white_45%,var(--coal))] sm:px-8">
        © {new Date().getFullYear()} GodManager.One · GodManager Trust
      </footer>
    </div>
  );
}
