import { NextResponse } from 'next/server';
import { CountryCode } from 'plaid';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { toClientScopeUser } from '@/lib/clientScope';
import { parseBankLinkType, resolveBankLinkEntity } from '@/lib/bankLinkScope';
import { getPlaidClient, pickPlaidAccount } from '@/lib/plaid';

export const dynamic = 'force-dynamic';

function plaidConfigErrorMessage(e: unknown): string | null {
  const msg = e instanceof Error ? e.message : String(e);
  if (
    msg.includes('PLAID_CLIENT_ID') ||
    msg.includes('PLAID_SECRET') ||
    msg.includes('PLAID_ENV') ||
    msg.includes('ENCRYPTION_KEY')
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
    const entityId = typeof body?.entityId === 'string' ? body.entityId.trim() : '';
    const publicToken =
      typeof body?.publicToken === 'string' ? body.publicToken.trim() : '';

    if (!linkType) {
      return NextResponse.json({ ok: false, error: 'linkType invalido (TENANT|OWNER|CLIENT).' }, { status: 400 });
    }
    if (!entityId) {
      return NextResponse.json({ ok: false, error: 'entityId obrigatorio.' }, { status: 400 });
    }
    if (!publicToken) {
      return NextResponse.json({ ok: false, error: 'publicToken obrigatorio.' }, { status: 400 });
    }

    const scopeUser = toClientScopeUser(user);
    const entity = await resolveBankLinkEntity(scopeUser, linkType, entityId);
    if (!entity.ok) {
      return NextResponse.json({ ok: false, error: entity.error }, { status: entity.status });
    }

    const plaid = getPlaidClient();
    const exchange = await plaid.itemPublicTokenExchange({ public_token: publicToken });
    const accessToken = exchange.data.access_token;
    const plaidItemId = exchange.data.item_id;

    if (!accessToken || !plaidItemId) {
      return NextResponse.json({ ok: false, error: 'Resposta Plaid incompleta.' }, { status: 500 });
    }

    let institutionName: string | null = null;
    try {
      const itemRes = await plaid.itemGet({ access_token: accessToken });
      const institutionId = itemRes.data.item.institution_id;
      if (institutionId) {
        const instRes = await plaid.institutionsGetById({
          institution_id: institutionId,
          country_codes: [CountryCode.Us],
        });
        institutionName = instRes.data.institution.name ?? null;
      }
    } catch (instErr) {
      console.warn(
        '[POST /api/plaid/exchange] institution lookup failed',
        instErr instanceof Error ? instErr.message : 'unknown',
      );
    }

    const accountsRes = await plaid.accountsGet({ access_token: accessToken });
    const account = pickPlaidAccount(accountsRes.data.accounts);
    if (!account) {
      return NextResponse.json({ ok: false, error: 'Nenhuma conta encontrada no Item Plaid.' }, { status: 400 });
    }

    const accessTokenEnc = encrypt(accessToken);

    const row = await prisma.bankLink.upsert({
      where: {
        clientId_linkType_entityId: {
          clientId: entity.clientId,
          linkType,
          entityId,
        },
      },
      create: {
        clientId: entity.clientId,
        linkType,
        entityId,
        accessTokenEnc,
        plaidItemId,
        institutionName,
        accountId: account.account_id,
        accountMask: account.mask ?? null,
        accountName: account.name ?? null,
        accountSubtype: account.subtype ?? null,
        status: 'active',
      },
      update: {
        accessTokenEnc,
        plaidItemId,
        institutionName,
        accountId: account.account_id,
        accountMask: account.mask ?? null,
        accountName: account.name ?? null,
        accountSubtype: account.subtype ?? null,
        status: 'active',
      },
      select: {
        institutionName: true,
        accountMask: true,
      },
    });

    return NextResponse.json({
      ok: true,
      linked: true,
      institutionName: row.institutionName ?? null,
      accountMask: row.accountMask ?? null,
    });
  } catch (e) {
    const configMsg = plaidConfigErrorMessage(e);
    if (configMsg) {
      return NextResponse.json({ ok: false, error: configMsg }, { status: 503 });
    }
    console.error('[POST /api/plaid/exchange]', e instanceof Error ? e.message : 'Plaid exchange error');
    return NextResponse.json({ ok: false, error: 'Falha ao vincular conta.' }, { status: 500 });
  }
}
