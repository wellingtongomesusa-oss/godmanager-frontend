import { NextResponse } from 'next/server';

import { getRampToken } from '@/lib/ramp-auth';

export const dynamic = 'force-dynamic';

export type RampTestOk = { ok: true; token_preview: string };
export type RampTestErr = { ok: false; error: string };

export async function GET() {
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
