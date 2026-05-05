import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { AUTH_COOKIE } from '@/lib/constants';

const intl = createMiddleware(routing);

function parseAuthCookie(value: string | undefined): { exp: number; role: string } | null {
  if (!value) return null;
  try {
    const decoded = decodeURIComponent(value);
    const json = JSON.parse(atob(decoded)) as { exp: number; userId: string; role: string };
    if (!json.exp || typeof json.role !== 'string') return null;
    return { exp: json.exp, role: json.role };
  } catch {
    return null;
  }
}

function preferredLoginLocale(request: NextRequest): string {
  const c = request.cookies.get('NEXT_LOCALE')?.value;
  if (c && (routing.locales as readonly string[]).includes(c)) {
    return c;
  }
  return routing.defaultLocale;
}

/**
 * Rotas do App Router fora de [locale] — sem prefixo de idioma.
 */
function isNonIntlPath(pathname: string): boolean {
  if (pathname.includes('.')) {
    return true;
  }
  const prefixes: string[] = [
    '/api',
    '/_next',
    '/_vercel',
    '/dashboard',
    '/admin',
    '/account',
    '/register',
    '/auth-by-token',
    '/manager-pro',
    '/owner-portal',
    '/gm',
    '/gm-premium',
    '/form-owner',
    '/form-tenant',
    '/resultado',
    '/crm',
    '/static',
  ];
  for (const pre of prefixes) {
    if (pathname === pre || pathname.startsWith(`${pre}/`)) {
      return true;
    }
  }
  if (pathname === '/GodManager_Premium' || pathname.startsWith('/GodManager_Premium/')) {
    return true;
  }
  if (pathname === '/GodManager_Premium.html') {
    return true;
  }
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const raw = request.cookies.get(AUTH_COOKIE)?.value;
  const session = parseAuthCookie(raw);
  const authed = session && Date.now() <= session.exp;

  if (
    pathname === '/form-owner.html' ||
    pathname === '/form-tenant.html' ||
    pathname === '/form-owner' ||
    pathname === '/form-tenant' ||
    pathname.startsWith('/form-owner/') ||
    pathname.startsWith('/form-tenant/')
  ) {
    return NextResponse.next();
  }
  if (pathname === '/resultado' || pathname === '/resultado/' || pathname.startsWith('/resultado/')) {
    return NextResponse.next();
  }
  if (
    pathname === '/gm' ||
    pathname === '/gm/' ||
    pathname === '/gm-premium' ||
    pathname === '/gm-premium/'
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/GodManager_Premium.html';
    return NextResponse.rewrite(url);
  }

  if (pathname === '/' || pathname === '') {
    const loc = preferredLoginLocale(request);
    return NextResponse.redirect(new URL(`/${loc}/login`, request.url));
  }
  if (pathname === '/login' || (pathname.startsWith('/login/') && !pathname.match(/^\/(en|pt-br|es)\//))) {
    const loc = preferredLoginLocale(request);
    const u = new URL(`/${loc}/login`, request.url);
    u.search = request.nextUrl.search;
    return NextResponse.redirect(u);
  }

  if (isNonIntlPath(pathname)) {
    if (pathname === '/register' || pathname.startsWith('/register/')) {
      if (authed) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
      return NextResponse.next();
    }
    const isProtected =
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/admin') ||
      pathname.startsWith('/account') ||
      pathname === '/GodManager_Premium.html' ||
      pathname.startsWith('/GodManager_Premium');
    if (!isProtected) {
      return NextResponse.next();
    }
    if (!authed || !session) {
      const loc = preferredLoginLocale(request);
      const login = new URL(`/${loc}/login`, request.url);
      login.searchParams.set('from', pathname);
      return NextResponse.redirect(login);
    }
    if (pathname.startsWith('/admin') && session.role !== 'admin' && session.role !== 'super_admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  if (pathname.match(/^\/(en|pt-br|es)\/login\/?$/) && authed) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return intl(request);
}

export const config = {
  matcher: ['/', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
