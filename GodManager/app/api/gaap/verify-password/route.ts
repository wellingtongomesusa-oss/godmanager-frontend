import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

const MASTER_PASSWORD = '151052';

function hashPwd(pwd: string): string {
  const s = String(pwd);
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h = h | 0;
  }
  return 'gh_' + (h >>> 0).toString(36) + '_' + s.length;
}

async function logAudit(
  user: { id: string; email: string | null } | null,
  action: string,
  details: Record<string, unknown>,
  req: Request,
) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    null;
  const userAgent = req.headers.get('user-agent')?.slice(0, 400) || null;
  await prisma.auditEntry
    .create({
      data: {
        actorId: user?.id ?? null,
        actorEmail: user?.email ?? null,
        action,
        entity: 'gaap',
        details: JSON.stringify(details),
        ip,
        userAgent,
      },
    })
    .catch(() => {});
}

export async function POST(req: Request) {
  const u = await getCurrentUserFromSession();
  if (!u) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const pwd = String(body?.password || '').trim();
    if (!/^\d{6}$/.test(pwd)) {
      return NextResponse.json({ ok: false, error: 'Senha deve ter 6 digitos numericos.' }, { status: 400 });
    }

    if (pwd === MASTER_PASSWORD) {
      await logAudit(u, 'gaap_unlock', { success: true, via: 'master' }, req);
      return NextResponse.json({ ok: true, oneShot: false, via: 'master' });
    }

    const stored = await prisma.appSetting.findUnique({ where: { key: 'gaap_password_hash' } });
    if (!stored) {
      await logAudit(u, 'gaap_unlock_fail', { success: false, reason: 'no_password' }, req);
      return NextResponse.json({ ok: false, error: 'Senha nao configurada' }, { status: 404 });
    }

    const v = (stored.value && typeof stored.value === 'object' ? (stored.value as Record<string, unknown>) : {}) as {
      hash?: unknown;
      oneShot?: unknown;
    };
    const expected = typeof v.hash === 'string' ? v.hash : '';
    if (!expected || hashPwd(pwd) !== expected) {
      await logAudit(u, 'gaap_unlock_fail', { success: false, reason: 'wrong_password' }, req);
      return NextResponse.json({ ok: false, error: 'Senha incorrecta.' }, { status: 401 });
    }

    const oneShot = v.oneShot === true;
    if (oneShot) {
      await prisma.appSetting.delete({ where: { key: 'gaap_password_hash' } }).catch(() => {});
      const hist = await prisma.appSetting.findUnique({ where: { key: 'gaap_password_history' } });
      const arr: Record<string, unknown>[] = Array.isArray(hist?.value)
        ? ([...(hist!.value as unknown as Record<string, unknown>[])])
        : [];
      if (arr.length > 0 && arr[0] && arr[0].used !== true) {
        arr[0].used = true;
        arr[0].usedAt = new Date().toISOString();
        arr[0].usedBy = u.email || u.id;
      }
      await prisma.appSetting
        .upsert({
          where: { key: 'gaap_password_history' },
          update: { value: arr as unknown as object, updatedBy: u.email || u.id },
          create: { key: 'gaap_password_history', value: arr as unknown as object, updatedBy: u.email || u.id },
        })
        .catch(() => {});
    }

    await logAudit(u, 'gaap_unlock', { success: true, oneShot }, req);
    return NextResponse.json({ ok: true, oneShot });
  } catch (e) {
    console.error('[POST /api/gaap/verify-password]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
