import { NextResponse } from 'next/server';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { qbConfig, getConnectionStatus } from '@/lib/quickbooks';

export const dynamic = 'force-dynamic';

/** GET /api/quickbooks/status?clientId= → estado da conexão QuickBooks do cliente. */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });

  const cfg = qbConfig();
  const clientId = new URL(req.url).searchParams.get('clientId');
  const scope = await resolveBankAccountClientScope(user, clientId);
  if (!scope.ok) {
    return NextResponse.json({ ok: true, configured: cfg.isConfigured, connected: false, environment: cfg.environment });
  }

  const conn = await getConnectionStatus(scope.clientId);
  return NextResponse.json({
    ok: true,
    configured: cfg.isConfigured,
    environment: cfg.environment,
    connected: !!conn && conn.status === 'CONNECTED',
    status: conn?.status ?? null,
    realmId: conn?.realmId ?? null,
    connectedAt: conn?.connectedAt ? conn.connectedAt.toISOString() : null,
    expiresAt: conn?.expiresAt ? conn.expiresAt.toISOString() : null,
    lastSyncAt: conn?.lastSyncAt ? conn.lastSyncAt.toISOString() : null,
  });
}
