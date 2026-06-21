import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { toClientScopeUser } from '@/lib/clientScope';
import { parseBankLinkType, resolveBankLinkEntity } from '@/lib/bankLinkScope';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const linkType = parseBankLinkType(url.searchParams.get('linkType'));
    const entityId = (url.searchParams.get('entityId') || '').trim();

    if (!linkType) {
      return NextResponse.json({ ok: false, error: 'linkType invalido (TENANT|OWNER|CLIENT).' }, { status: 400 });
    }
    if (!entityId) {
      return NextResponse.json({ ok: false, error: 'entityId obrigatorio.' }, { status: 400 });
    }

    const scopeUser = toClientScopeUser(user);
    const entity = await resolveBankLinkEntity(scopeUser, linkType, entityId);
    if (!entity.ok) {
      return NextResponse.json({ ok: false, error: entity.error }, { status: entity.status });
    }

    const row = await prisma.bankLink.findUnique({
      where: {
        clientId_linkType_entityId: {
          clientId: entity.clientId,
          linkType,
          entityId,
        },
      },
      select: {
        institutionName: true,
        accountMask: true,
        status: true,
      },
    });

    if (!row || row.status !== 'active') {
      return NextResponse.json({
        ok: true,
        linked: false,
        institutionName: null,
        accountMask: null,
        status: row?.status ?? null,
      });
    }

    return NextResponse.json({
      ok: true,
      linked: true,
      institutionName: row.institutionName ?? null,
      accountMask: row.accountMask ?? null,
      status: row.status,
    });
  } catch (e) {
    console.error('[GET /api/plaid/status]', e instanceof Error ? e.message : 'error');
    return NextResponse.json({ ok: false, error: 'Falha ao consultar status.' }, { status: 500 });
  }
}
