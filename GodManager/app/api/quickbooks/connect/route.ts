import { NextResponse } from 'next/server';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { qbConfig, buildAuthorizeUrl } from '@/lib/quickbooks';

export const dynamic = 'force-dynamic';

/** GET /api/quickbooks/connect?clientId= → redireciona ao consentimento do Intuit (OAuth2). */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });

  const cfg = qbConfig();
  if (!cfg.isConfigured) {
    return NextResponse.json(
      { ok: false, error: 'QuickBooks não configurado (defina QB_CLIENT_ID, QB_CLIENT_SECRET, QB_REDIRECT_URI).' },
      { status: 503 },
    );
  }

  const clientId = new URL(req.url).searchParams.get('clientId');
  const scope = await resolveBankAccountClientScope(user, clientId);
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

  return NextResponse.redirect(buildAuthorizeUrl(scope.clientId));
}
