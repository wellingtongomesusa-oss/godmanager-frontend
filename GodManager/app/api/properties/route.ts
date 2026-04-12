import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Cadastro de propriedade Long Term — persistência server-side pode ser ligada depois (DB). */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
    }
    const id = typeof body.id === 'string' && body.id ? body.id : `lt_${Date.now()}`;
    return NextResponse.json({ ok: true, receivedAt: new Date().toISOString(), ...body, id });
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
}
