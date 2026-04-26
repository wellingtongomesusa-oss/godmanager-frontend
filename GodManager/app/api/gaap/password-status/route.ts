import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession, isAdminUser } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

export async function GET() {
  const u = await getCurrentUserFromSession();
  if (!u) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const s = await prisma.appSetting.findUnique({ where: { key: 'gaap_password_hash' } });
    let oneShot = false;
    if (s && s.value && typeof s.value === 'object') {
      const v = s.value as { oneShot?: unknown };
      oneShot = v.oneShot === true;
    }
    return NextResponse.json({ ok: true, hasPassword: !!s, oneShot, isAdmin: isAdminUser(u) });
  } catch (e) {
    console.error('[GET /api/gaap/password-status]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
