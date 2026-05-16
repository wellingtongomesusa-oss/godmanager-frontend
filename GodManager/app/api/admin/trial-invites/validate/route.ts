import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET ?token=... → validação pública (não marca como usado)
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    if (!token) return NextResponse.json({ ok: false, error: 'No token' }, { status: 400 });

    const invite = await prisma.trialInvite.findUnique({ where: { token } });
    if (!invite) return NextResponse.json({ ok: false, error: 'Token inválido' }, { status: 404 });
    if (invite.usedAt) return NextResponse.json({ ok: false, error: 'Token já usado' }, { status: 410 });
    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ ok: false, error: 'Token expirado' }, { status: 410 });
    }

    return NextResponse.json({ ok: true, email: invite.email, note: invite.note });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
