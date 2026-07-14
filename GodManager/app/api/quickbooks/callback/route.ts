import { NextResponse } from 'next/server';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { verifyState, exchangeCodeForTokens, saveIntegration, qbConfig } from '@/lib/quickbooks';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

/**
 * Origem PÚBLICA para o redirect de volta ao app. NÃO usar new URL(req.url).origin —
 * atrás do proxy (Railway) isso vira o host interno (localhost:3101) e o browser não
 * consegue acessar. Deriva do QB_REDIRECT_URI (config público) e, como fallback,
 * dos headers x-forwarded-* do proxy.
 */
function publicOrigin(req: Request): string {
  try {
    const r = qbConfig().redirectUri;
    if (r) return new URL(r).origin;
  } catch {
    /* ignore */
  }
  const xfHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const xfProto = req.headers.get('x-forwarded-proto') || 'https';
  if (xfHost && !/^localhost|127\.0\.0\.1/.test(xfHost)) return `${xfProto}://${xfHost}`;
  return new URL(req.url).origin;
}

/**
 * GET /api/quickbooks/callback?code=&realmId=&state=
 * Redirect do Intuit após consentimento. Troca o code por tokens e salva a conexão.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = publicOrigin(req);
  const back = (status: string, msg?: string) => {
    const u = new URL('/GodManager_Premium.html', origin);
    u.searchParams.set('qb', status);
    if (msg) u.searchParams.set('qbMsg', msg.slice(0, 140));
    u.hash = 'quickbooks';
    return NextResponse.redirect(u.toString());
  };

  const error = url.searchParams.get('error');
  if (error) return back('error', url.searchParams.get('error_description') || error);

  const code = url.searchParams.get('code') || '';
  const realmId = url.searchParams.get('realmId');
  const state = url.searchParams.get('state') || '';
  if (!code || !state) {
    console.error('[quickbooks/callback] params incompletos', {
      hasCode: !!code, hasState: !!state, realmId, keys: [...url.searchParams.keys()],
    });
    return back('error', 'Resposta incompleta do Intuit.');
  }

  const clientId = verifyState(state);
  if (!clientId) return back('error', 'State inválido ou expirado. Tente conectar novamente.');

  const user = await getCurrentUserFromSession();

  try {
    const tokens = await exchangeCodeForTokens(code);
    await saveIntegration({ clientId, realmId, tokens, userId: user?.id ?? null });
    if (user) {
      await recordAudit({
        request: req,
        actor: { id: user.id, email: user.email },
        action: 'quickbooks.connect',
        entity: 'client_integration',
        entityId: clientId,
        clientId,
        details: `realmId:${realmId ?? ''}`,
      });
    }
    return back('connected', realmId ? `Empresa ${realmId}` : undefined);
  } catch (e) {
    console.error('[quickbooks/callback]', e);
    return back('error', e instanceof Error ? e.message : 'Falha ao trocar o código.');
  }
}
