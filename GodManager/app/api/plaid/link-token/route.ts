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
    const response = await plaid.linkTokenCreate({
      user: { client_user_id: entityId },
      client_name: 'GodManager',
      products: [Products.Auth, Products.Identity],
      country_codes: [CountryCode.Us],
      language: 'en',
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
    console.error('[POST /api/plaid/link-token]', e instanceof Error ? e.message : 'Plaid error');
    return NextResponse.json({ ok: false, error: 'Falha ao criar link token.' }, { status: 500 });
  }
}
