import { NextResponse } from 'next/server';

import { getRampToken } from '@/lib/ramp-auth';
import { requireSuperAdmin } from '@/lib/requireSuperAdmin';

export const dynamic = 'force-dynamic';

export type RampTestOk = { ok: true; token_preview: string };
export type RampTestErr = { ok: false; error: string };

export async function GET() {
  const gate = await requireSuperAdmin();
  if (gate.error) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  try {
    const token = await getRampToken();
    const token_preview = token.slice(0, 10);
    const body: RampTestOk = { ok: true, token_preview };
    return NextResponse.json(body);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const body: RampTestErr = { ok: false, error: message };
    return NextResponse.json(body, { status: 500 });
  }
}
