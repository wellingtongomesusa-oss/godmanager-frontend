import { NextResponse } from 'next/server';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { revokeAndDisconnect } from '@/lib/quickbooks';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

/** POST /api/quickbooks/disconnect  { clientId? } → revoga tokens e remove a conexão. */
export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { clientId?: string };
  const scope = await resolveBankAccountClientScope(user, body?.clientId ?? null);
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

  try {
    await revokeAndDisconnect(scope.clientId);
    await recordAudit({
      request: req,
      actor: { id: user.id, email: user.email },
      action: 'quickbooks.disconnect',
      entity: 'client_integration',
      entityId: scope.clientId,
      clientId: scope.clientId,
      details: '',
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[quickbooks/disconnect]', e);
    return NextResponse.json({ ok: false, error: 'Falha ao desconectar.' }, { status: 500 });
  }
}
