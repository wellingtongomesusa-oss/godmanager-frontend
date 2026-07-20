import { NextResponse } from 'next/server';
import { csrfGuard } from '@/lib/csrfGuard';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { decrypt } from '@/lib/encryption';
import { recordAudit } from '@/lib/auditServer';
import {
  coerceBankLinkEntityId,
  parseBankLinkType,
  resolveBankLinkEntity,
  toBankLinkActor,
} from '@/lib/bankLinkScope';
import { createBankTransfer, isPlaidTransferEnabled, type TransferDir } from '@/lib/plaidTransfer';
import { getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

/** Lista o livro-razão de transferências (escopo por empresa). */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const url = new URL(req.url);
    const where: Prisma.BankTransferWhereInput = { ...getClientScopeWhere(toClientScopeUser(user)) };
    const linkType = parseBankLinkType(url.searchParams.get('linkType'));
    if (linkType) where.linkType = linkType;
    const entityId = (url.searchParams.get('entityId') || '').trim();
    if (entityId) where.entityId = entityId;

    const rows = await prisma.bankTransfer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return NextResponse.json({ ok: true, transfers: rows });
  } catch (e) {
    console.error('[GET /api/plaid/transfers]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}

/** Inicia um débito/crédito ACH. Só super_admin, só com a flag ligada. */
export async function POST(req: Request) {
  const bad = csrfGuard(req);
  if (bad) return bad;
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'super_admin') {
    return NextResponse.json({ ok: false, error: 'Apenas super_admin pode mover dinheiro.' }, { status: 403 });
  }
  if (!isPlaidTransferEnabled()) {
    return NextResponse.json(
      { ok: false, error: 'Plaid Transfer desabilitado. Defina PLAID_TRANSFER_ENABLED=true.' },
      { status: 403 },
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const linkType = parseBankLinkType(body?.linkType);
    if (!linkType) {
      return NextResponse.json({ ok: false, error: 'linkType invalido (TENANT|OWNER|CLIENT).' }, { status: 400 });
    }
    const dirRaw = String(body?.direction || '').toUpperCase();
    if (dirRaw !== 'DEBIT' && dirRaw !== 'CREDIT') {
      return NextResponse.json({ ok: false, error: 'direction deve ser DEBIT ou CREDIT.' }, { status: 400 });
    }
    const direction = dirRaw as TransferDir;
    const amountNum = Number(body?.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return NextResponse.json({ ok: false, error: 'Valor invalido.' }, { status: 400 });
    }
    const description = body?.description == null ? undefined : String(body.description).slice(0, 15);
    const achClass = body?.achClass === 'ccd' ? 'ccd' : 'ppd';

    const actor = toBankLinkActor(user);
    const coerced = coerceBankLinkEntityId(actor, linkType, String(body?.entityId || '').trim());
    if (!coerced.ok) return NextResponse.json({ ok: false, error: coerced.error }, { status: coerced.status });
    const entityId = coerced.entityId;

    const entity = await resolveBankLinkEntity(actor, linkType, entityId);
    if (!entity.ok) return NextResponse.json({ ok: false, error: entity.error }, { status: entity.status });
    const clientId = entity.clientId;

    const bankLink = await prisma.bankLink.findUnique({
      where: { clientId_linkType_entityId: { clientId, linkType, entityId } },
    });
    if (!bankLink || bankLink.status !== 'active' || !bankLink.accountId) {
      return NextResponse.json({ ok: false, error: 'Conta bancaria nao vinculada para esta entidade.' }, { status: 400 });
    }

    let accessToken: string;
    try {
      accessToken = decrypt(bankLink.accessTokenEnc);
    } catch {
      return NextResponse.json({ ok: false, error: 'Falha ao ler o token da conta.' }, { status: 500 });
    }

    const result = await createBankTransfer({
      accessToken,
      accountId: bankLink.accountId,
      direction,
      amount: amountNum,
      legalName: bankLink.accountName || 'Account Holder',
      description,
      achClass,
    });

    // Grava no ledger o que o Plaid confirmou (ou a falha) — fonte da verdade.
    const row = await prisma.bankTransfer.create({
      data: {
        clientId,
        linkType,
        entityId,
        bankLinkId: bankLink.id,
        direction,
        amount: amountNum,
        description: description ?? null,
        achClass,
        status: result.ok ? result.status ?? 'pending' : 'failed',
        plaidAuthorizationId: result.authorizationId ?? null,
        plaidTransferId: result.transferId ?? null,
        failureReason: result.ok ? null : result.error ?? 'erro',
        createdByUserId: user.id,
      },
    });

    await recordAudit({
      request: req,
      actor: { id: user.id, email: user.email },
      action: result.ok ? 'bank_transfer.create' : 'bank_transfer.failed',
      entity: 'bank_transfer',
      entityId: row.id,
      clientId,
      details: JSON.stringify({
        direction,
        amount: amountNum,
        linkType,
        targetEntityId: entityId,
        status: row.status,
        error: result.ok ? undefined : result.error,
      }),
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error, transfer: row }, { status: 400 });
    }
    return NextResponse.json({ ok: true, transfer: row });
  } catch (e) {
    console.error('[POST /api/plaid/transfers]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
