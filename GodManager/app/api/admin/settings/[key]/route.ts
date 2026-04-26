import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentAdminFromSession } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

function serialize(s: { id: string; key: string; value: unknown; updatedAt: Date; updatedBy: string | null } | null) {
  if (!s) return null;
  return {
    id: s.id,
    key: s.key,
    value: s.value,
    updatedAt: s.updatedAt.toISOString(),
    updatedBy: s.updatedBy ?? null,
  };
}

export async function GET(_req: Request, { params }: { params: { key: string } }) {
  const admin = await getCurrentAdminFromSession();
  if (!admin) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  try {
    const s = await prisma.appSetting.findUnique({ where: { key: params.key } });
    return NextResponse.json({ ok: true, setting: serialize(s) });
  } catch (e) {
    console.error('[GET /api/admin/settings]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { key: string } }) {
  const admin = await getCurrentAdminFromSession();
  if (!admin) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  try {
    const body = await req.json().catch(() => ({}));
    const value = body?.value;
    if (value === undefined) {
      return NextResponse.json({ ok: false, error: 'value required' }, { status: 400 });
    }
    const updatedBy = admin.email || admin.id;
    const s = await prisma.appSetting.upsert({
      where: { key: params.key },
      update: { value, updatedBy },
      create: { key: params.key, value, updatedBy },
    });
    return NextResponse.json({ ok: true, setting: serialize(s) });
  } catch (e) {
    console.error('[PUT /api/admin/settings]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { key: string } }) {
  const admin = await getCurrentAdminFromSession();
  if (!admin) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  try {
    await prisma.appSetting.delete({ where: { key: params.key } }).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[DELETE /api/admin/settings]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
