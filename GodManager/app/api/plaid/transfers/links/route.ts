import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { isPlaidTransferEnabled } from '@/lib/plaidTransfer';

export const dynamic = 'force-dynamic';

/**
 * Lista as contas bancárias vinculadas (para o seletor da tela de transferências) e
 * informa se o Transfer está ligado e em que ambiente. Só super_admin.
 */
export async function GET() {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'super_admin') {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const rows = await prisma.bankLink.findMany({
      where: { status: 'active' },
      orderBy: { updatedAt: 'desc' },
      include: { client: { select: { companyName: true } } },
    });
    const links = rows
      .filter((r) => r.accountId)
      .map((r) => ({
        id: r.id,
        clientId: r.clientId,
        companyName: r.client?.companyName ?? null,
        linkType: r.linkType,
        entityId: r.entityId,
        institutionName: r.institutionName,
        accountMask: r.accountMask,
        accountName: r.accountName,
      }));
    return NextResponse.json({
      ok: true,
      enabled: isPlaidTransferEnabled(),
      env: String(process.env.PLAID_ENV || 'sandbox').toLowerCase(),
      links,
    });
  } catch (e) {
    console.error('[GET /api/plaid/transfers/links]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
