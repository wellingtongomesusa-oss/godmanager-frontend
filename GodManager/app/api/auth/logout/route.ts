import { NextResponse } from 'next/server';
import { clearSessionCookieOptions } from '@/lib/authServer';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  const c = clearSessionCookieOptions();
  res.cookies.set(c.name, c.value, {
    httpOnly: c.httpOnly,
    secure: c.secure,
    sameSite: c.sameSite,
    path: c.path,
    maxAge: c.maxAge,
  });
  return res;
}
