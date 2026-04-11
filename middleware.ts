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

  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname === '/GodManager_Premium.html';

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
    '/login',
    '/login/:path*',
    '/register',
    '/register/:path*',
    '/dashboard',
    '/dashboard/:path*',
    '/admin/:path*',
    '/GodManager_Premium.html',
  ],
};
