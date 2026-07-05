import { NextResponse } from 'next/server';
import { reconcilePendingTransfers } from '@/lib/plaidTransfer';

export const dynamic = 'force-dynamic';

/**
 * Webhook do Plaid Transfer. É apenas um GATILHO: ao ser chamado, reconsultamos o
 * status real de cada transferência em andamento via transferGet (fonte da verdade).
 * Por isso não confiamos no corpo do webhook para mover nada — um webhook falso, no
 * máximo, dispara uma reconsulta inofensiva. Guarda extra: ?secret= (PLAID_WEBHOOK_SECRET).
 */
export async function POST(req: Request) {
  try {
    const expected = (process.env.PLAID_WEBHOOK_SECRET || '').trim();
    if (expected) {
      const got = new URL(req.url).searchParams.get('secret') || '';
      if (got !== expected) {
        return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
      }
    }

    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const webhookType = String((body as { webhook_type?: unknown }).webhook_type || '').toUpperCase();

    // Só reagimos a eventos de Transfer; ignoramos o resto com 200 (Plaid reenvia em erro).
    if (webhookType === 'TRANSFER') {
      const result = await reconcilePendingTransfers();
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ ok: true, ignored: webhookType || 'unknown' });
  } catch (e) {
    console.error('[POST /api/plaid/transfers/webhook]', e);
    // 200 mesmo em erro interno evita retries em loop por algo não-recuperável.
    return NextResponse.json({ ok: false, error: 'handled' });
  }
}
