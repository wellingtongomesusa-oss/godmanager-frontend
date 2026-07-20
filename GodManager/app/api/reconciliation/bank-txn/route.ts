import { NextResponse } from 'next/server';
import { csrfGuard } from '@/lib/csrfGuard';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/reconciliation/bank-txn  { id, matched, clientId? }
 * Marca/desmarca uma transação do extrato do banco como conferida (matched). Escopo por cliente.
 */
export async function PATCH(req: Request) {
  const bad = csrfGuard(req);
  if (bad) return bad;
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });

  try {
    const body = (await req.json().catch(() => ({}))) as { id?: string; matched?: unknown; clientId?: string };
    const id = String(body?.id || '').trim();
    if (!id) return NextResponse.json({ ok: false, error: 'id obrigatório.' }, { status: 400 });

    const scope = await resolveBankAccountClientScope(user, body?.clientId ?? null);
    if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

    const txn = await prisma.bankStatementTxn.findUnique({ where: { id }, select: { clientId: true } });
    if (!txn || txn.clientId !== scope.clientId) {
      return NextResponse.json({ ok: false, error: 'Transação não encontrada.' }, { status: 404 });
    }

    const updated = await prisma.bankStatementTxn.update({
      where: { id },
      data: { matched: body?.matched === true },
      select: { id: true, matched: true },
    });
    return NextResponse.json({ ok: true, id: updated.id, matched: updated.matched });
  } catch (e) {
    console.error('[PATCH /api/reconciliation/bank-txn]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Falha ao atualizar.' }, { status: 500 });
  }
}
