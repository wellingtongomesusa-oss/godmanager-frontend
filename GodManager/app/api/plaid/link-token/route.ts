import { NextResponse } from 'next/server';
import { CountryCode, Products } from 'plaid';
import { getCurrentUserFromSession } from '@/lib/authServer';
import {
  coerceBankLinkEntityId,
  parseBankLinkType,
  resolveBankLinkEntity,
  toBankLinkActor,
} from '@/lib/bankLinkScope';
import { getPlaidClient } from '@/lib/plaid';

export const dynamic = 'force-dynamic';

function plaidConfigErrorMessage(e: unknown): string | null {
  const msg = e instanceof Error ? e.message : String(e);
  if (
    msg.includes('PLAID_CLIENT_ID') ||
    msg.includes('PLAID_SECRET') ||
    msg.includes('PLAID_ENV')
  ) {
    return msg;
  }
  return null;
}

/**
 * Erros da Plaid chegam como erro do Axios: o motivo real (error_code / error_message /
 * error_type / display_message) fica em e.response.data, NAO em e.message (que vira so
 * "Request failed with status code 4xx"). Extrai esse detalhe para log e resposta.
 * Nenhum campo aqui contem segredo (client_id/secret nunca sao ecoados pela Plaid).
 */
function extractPlaidError(e: unknown): {
  status: number;
  errorType?: string;
  errorCode?: string;
  errorMessage?: string;
  displayMessage?: string;
  requestId?: string;
} | null {
  const resp = (e as { response?: { status?: number; data?: Record<string, unknown> } })?.response;
  const data = resp?.data;
  if (!data || typeof data !== 'object') return null;
  return {
    status: typeof resp?.status === 'number' ? resp.status : 500,
    errorType: typeof data.error_type === 'string' ? data.error_type : undefined,
    errorCode: typeof data.error_code === 'string' ? data.error_code : undefined,
    errorMessage: typeof data.error_message === 'string' ? data.error_message : undefined,
    displayMessage: typeof data.display_message === 'string' ? data.display_message : undefined,
    requestId: typeof data.request_id === 'string' ? data.request_id : undefined,
  };
}

export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const linkType = parseBankLinkType(
      typeof body?.linkType === 'string' ? body.linkType : '',
    );
    const requestedEntityId =
      typeof body?.entityId === 'string' ? body.entityId.trim() : '';

    if (!linkType) {
      return NextResponse.json({ ok: false, error: 'linkType invalido (TENANT|OWNER|CLIENT).' }, { status: 400 });
    }

    const actor = toBankLinkActor(user);
    const coerced = coerceBankLinkEntityId(actor, linkType, requestedEntityId);
    if (!coerced.ok) {
      return NextResponse.json({ ok: false, error: coerced.error }, { status: coerced.status });
    }
    const entityId = coerced.entityId;

    const entity = await resolveBankLinkEntity(actor, linkType, entityId);
    if (!entity.ok) {
      return NextResponse.json({ ok: false, error: entity.error }, { status: entity.status });
    }

    const plaid = getPlaidClient();
    // OAuth (Chase e afins) exige redirect_uri registrado no Plaid Dashboard (Allowed redirect URIs).
    // So enviamos se estiver configurado; caso contrario a Plaid rejeita URIs nao registradas.
    const redirectUri = (process.env.PLAID_REDIRECT_URI || '').trim() || undefined;
    const response = await plaid.linkTokenCreate({
      user: { client_user_id: entityId },
      client_name: 'GodManager',
      products: [Products.Auth, Products.Identity, Products.Transactions],
      // Statements é add-on: só entra se habilitado na conta Plaid; senão o Plaid ignora.
      additional_consented_products:
        String(process.env.PLAID_STATEMENTS_ENABLED || '').toLowerCase() === 'true'
          ? [Products.Statements]
          : undefined,
      country_codes: [CountryCode.Us],
      language: 'en',
      ...(redirectUri ? { redirect_uri: redirectUri } : {}),
    });

    const linkToken = response.data.link_token;
    if (!linkToken) {
      return NextResponse.json({ ok: false, error: 'Plaid nao retornou link_token.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, linkToken });
  } catch (e) {
    const configMsg = plaidConfigErrorMessage(e);
    if (configMsg) {
      return NextResponse.json({ ok: false, error: configMsg }, { status: 503 });
    }
    const plaidErr = extractPlaidError(e);
    if (plaidErr) {
      // Log completo no servidor (com env atual para diagnostico rapido de sandbox vs production).
      console.error('[POST /api/plaid/link-token] Plaid', {
        env: process.env.PLAID_ENV || 'sandbox',
        status: plaidErr.status,
        error_type: plaidErr.errorType,
        error_code: plaidErr.errorCode,
        error_message: plaidErr.errorMessage,
        request_id: plaidErr.requestId,
      });
      // Devolve o motivo real (nao contem segredos) para facilitar o diagnostico no front/cowork.
      const detail = [plaidErr.errorCode, plaidErr.errorMessage || plaidErr.displayMessage]
        .filter(Boolean)
        .join(': ');
      return NextResponse.json(
        {
          ok: false,
          error: detail || 'Falha ao criar link token.',
          plaid: {
            errorType: plaidErr.errorType,
            errorCode: plaidErr.errorCode,
            errorMessage: plaidErr.errorMessage,
            requestId: plaidErr.requestId,
          },
        },
        { status: plaidErr.status >= 400 && plaidErr.status < 600 ? plaidErr.status : 502 },
      );
    }
    console.error('[POST /api/plaid/link-token]', e instanceof Error ? e.message : 'Plaid error');
    return NextResponse.json({ ok: false, error: 'Falha ao criar link token.' }, { status: 500 });
  }
}
