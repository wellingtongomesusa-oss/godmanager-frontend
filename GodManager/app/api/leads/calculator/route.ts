import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@]+$/;

function ipFromHeaders(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip');
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? '').trim().toLowerCase();
    const properties = typeof body.properties === 'number' ? body.properties : Number(body.properties ?? 0);
    const currentSoftware = body.currentSoftware != null ? String(body.currentSoftware).slice(0, 80) : null;
    const savings = typeof body.savings === 'number' ? body.savings : Number(body.savings ?? 0);

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, code: 'INVALID_EMAIL' }, { status: 400 });
    }
    const safeProps = Number.isFinite(properties) ? Math.round(Math.min(5000, Math.max(0, properties))) : 0;
    const ip = ipFromHeaders(req);
    const userAgent = req.headers.get('user-agent');

    const details = JSON.stringify({
      properties: safeProps,
      currentSoftware,
      savingsMonthlyUsd: savings,
      source: 'savings_calculator',
    }).slice(0, 12000);

    await prisma.auditEntry
      .create({
        data: {
          actorId: null,
          actorEmail: email.slice(0, 320),
          action: 'calculator_lead',
          entity: 'marketing_lead',
          entityId: null,
          details,
          ip,
          userAgent: userAgent ? userAgent.slice(0, 500) : null,
        },
      })
      .catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[POST leads/calculator]', e);
    return NextResponse.json({ ok: false, code: 'INTERNAL' }, { status: 500 });
  }
}
