import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

// POST { email?, note?, expiresInDays? } → cria token (super_admin)
export async function POST(req: Request) {
  try {
    const user = await getCurrentUserFromSession();
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    if (user.role !== UserRole.super_admin) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const email = body.email ? String(body.email).trim().toLowerCase().slice(0, 200) : null;
    const note = body.note ? String(body.note).slice(0, 500) : null;
    const expiresInDays = Math.min(90, Math.max(1, parseInt(String(body.expiresInDays ?? '14'), 10) || 14));

    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    const createdByName =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email;

    const invite = await prisma.trialInvite.create({
      data: {
        token,
        email,
        note,
        expiresAt,
        createdById: user.id,
        createdBy: createdByName,
      },
    });

    const origin = req.headers.get('origin') || 'https://www.godmanager.us';
    const link = `${origin.replace(/\/$/, '')}/en/signup-trial?token=${token}`;

    return NextResponse.json({ ok: true, invite, link });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// GET → lista últimos 50 (super_admin)
export async function GET() {
  try {
    const user = await getCurrentUserFromSession();
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    if (user.role !== UserRole.super_admin) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const invites = await prisma.trialInvite.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ ok: true, invites });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
