'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getSession, clearSession } from '@/lib/manager-pro/auth';
import type { MasterOneLocale } from '@/lib/manager-pro/masterOneLocale';
import { MASTER_ONE_LOCALE_KEY, writeMasterOneLocale } from '@/lib/manager-pro/masterOneLocale';
import { tMasterOne } from '@/lib/manager-pro/masterOneStrings';
import { ChartRegister } from './ChartRegister';
import { DeadlineBanner } from './DeadlineBanner';
import { MasterOneLocaleContext } from './MasterOneContext';
import { MasterOneSidebar } from './MasterOneSidebar';
import { isAdminOrPrimary } from '@/lib/manager-pro/auth';

export function ManagerProShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [ok, setOk] = useState(false);
  const [locale, setLocale] = useState<MasterOneLocale>('pt');

  const isLogin = pathname === '/manager-pro/login';

  useEffect(() => {
    const s = getSession();
    setOk(!!s);
    setReady(true);
    if (!isLogin && !s) {
      router.replace('/manager-pro/login');
    }
  }, [isLogin, pathname, router]);

  useEffect(() => {
    if (isLogin && getSession()) {
      router.replace('/manager-pro');
    }
  }, [isLogin, router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(MASTER_ONE_LOCALE_KEY);
      setLocale(stored === 'en' ? 'en' : 'pt');
    }
  }, []);

  const setLang = (l: MasterOneLocale) => {
    setLocale(l);
    writeMasterOneLocale(l);
  };

  if (!ready) {
    return (
      <div className="gp-center-screen flex min-h-screen items-center justify-center bg-[var(--sand)]">
        <p className="text-sm text-[var(--ink2)]">Carregando…</p>
      </div>
    );
  }

  if (isLogin) {
    return (
      <>
        <ChartRegister />
        {children}
      </>
    );
  }

  if (!ok) {
    return (
      <div className="gp-center-screen flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--sand)] p-6 text-center">
        <p className="text-sm text-[var(--ink2)]">Sessão necessária para ver o painel.</p>
        <Link
          href="/manager-pro/login"
          className="rounded-lg bg-[var(--amber)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-95"
        >
          Ir para login
        </Link>
      </div>
    );
  }

  const session = getSession();
  const displayName = session?.name || session?.email || 'User';

  return (
    <>
      <ChartRegister />
      <div
        className="gp-shell flex min-h-screen flex-col bg-[var(--sand)]"
        data-godmanager-ui="godmanager-one-shell"
      >
        {isAdminOrPrimary() ? (
          <DeadlineBanner proposalUrl={process.env.NEXT_PUBLIC_TRUST_PROPOSAL_URL ?? '#'} />
        ) : null}
        <header className="gp-header flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#0f0e0c] px-4 text-white sm:px-6">
          <span className="gp-header-brand font-semibold tracking-tight text-white">
            GodManager<span className="gp-header-brand-accent text-[var(--amber)]">.One</span>
          </span>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
            <label className="flex items-center gap-1.5 text-[10px] font-medium text-white/70">
              <span className="hidden sm:inline">{tMasterOne(locale, 'header.lang')}</span>
              <select
                value={locale}
                onChange={(e) => setLang(e.target.value as MasterOneLocale)}
                className="rounded border border-white/20 bg-white/10 px-2 py-1 text-xs text-white"
              >
                <option value="pt">PT-BR</option>
                <option value="en">EN</option>
              </select>
            </label>
            <span className="max-w-[140px] truncate text-xs font-medium text-white/90 sm:max-w-[200px]">
              {displayName}
            </span>
            <button
              type="button"
              onClick={() => {
                clearSession();
                router.push('/manager-pro/login');
              }}
              className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
            >
              {tMasterOne(locale, 'header.logout')}
            </button>
          </div>
        </header>

        <MasterOneLocaleContext.Provider value={locale}>
          <div className="gp-body flex min-h-0 flex-1">
            <MasterOneSidebar locale={locale} />
            <main className="gp-main min-w-0 flex-1 overflow-auto p-4 sm:p-6">{children}</main>
          </div>
        </MasterOneLocaleContext.Provider>
      </div>
    </>
  );
}
