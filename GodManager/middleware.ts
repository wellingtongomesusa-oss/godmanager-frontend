import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { AUTH_COOKIE } from '@/lib/constants';

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /**
   * Consola Premium em public/: quando o dev server perde watchers (ex.: EMFILE no macOS),
   * o App Router pode deixar de registar rotas e devolver 404 em tudo excepto ficheiros estáticos.
   * O rewrite para o .html garante /gm e /gm-premium mesmo nesse estado.
   */
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

  const raw = request.cookies.get(AUTH_COOKIE)?.value;
  const session = parseAuthCookie(raw);
  const authed = session && Date.now() <= session.exp;

  if (pathname === '/login' || pathname.startsWith('/login/')) {
    if (authed) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  if (pathname === '/register' || pathname.startsWith('/register/')) {
    if (authed) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  /** HTML estático em public/ — não exigir cookie aqui (evita redirecionar para /login ao abrir o URL direto). */
  const isProtected =
    pathname.startsWith('/dashboard') || pathname.startsWith('/admin');

  if (!isProtected) {
    return NextResponse.next();
  }

  if (!authed || !session) {
    const login = new URL('/login', request.url);
    login.searchParams.set('from', pathname);
    return NextResponse.redirect(login);
  }

  if (pathname.startsWith('/admin') && session.role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/gm',
    '/gm/',
    '/gm-premium',
    '/gm-premium/',
    '/login',
    '/login/:path*',
    '/register',
    '/register/:path*',
    '/dashboard',
    '/dashboard/:path*',
    '/admin/:path*',
  ],
};
