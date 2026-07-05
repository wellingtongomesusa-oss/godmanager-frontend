import { NextResponse } from 'next/server';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { reconcilePendingTransfers, isPlaidTransferEnabled } from '@/lib/plaidTransfer';

export const dynamic = 'force-dynamic';

/** Força a reconsulta do status das transferências em andamento. Só super_admin. */
export async function POST() {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'super_admin') {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
  if (!isPlaidTransferEnabled()) {
    return NextResponse.json(
      { ok: false, error: 'Plaid Transfer desabilitado (PLAID_TRANSFER_ENABLED != true).' },
      { status: 403 },
    );
  }
  try {
    const result = await reconcilePendingTransfers();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('[POST /api/plaid/transfers/reconcile]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
