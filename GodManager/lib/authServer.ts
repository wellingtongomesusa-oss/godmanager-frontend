import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { AUTH_COOKIE, TOKEN_TTL_MS } from '@/lib/constants';
import type { UserRole } from '@/lib/types';

export interface AuthSession {
  userId: string;
  role: UserRole;
  exp: number;
}

function encode(payload: AuthSession): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function decode(raw: string | undefined): AuthSession | null {
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    const json = JSON.parse(Buffer.from(decoded, 'base64').toString('utf-8')) as AuthSession;
    if (!json.exp || !json.userId || !json.role) return null;
    if (Date.now() > json.exp) return null;
    return json;
  } catch {
    return null;
  }
}

export function createSessionCookie(userId: string, role: UserRole) {
  const exp = Date.now() + TOKEN_TTL_MS;
  const value = encode({ userId, role, exp });
  return {
    name: AUTH_COOKIE,
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: Math.floor(TOKEN_TTL_MS / 1000),
  };
}

export function clearSessionCookieOptions() {
  return {
    name: AUTH_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  };
}

export async function getSessionFromRequest(req: NextRequest): Promise<AuthSession | null> {
  const raw = req.cookies.get(AUTH_COOKIE)?.value;
  return decode(raw);
}

export async function getSessionFromCookies(): Promise<AuthSession | null> {
  const raw = cookies().get(AUTH_COOKIE)?.value;
  return decode(raw);
}

export async function getCurrentUserFromSession() {
  const session = await getSessionFromCookies();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return null;
  return user;
}
