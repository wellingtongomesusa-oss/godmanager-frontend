import { Prisma } from '@prisma/client';
import type { BillingDocument, BillingLineItem } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/db';
import { normalizeYearMonthForWrite } from '@/lib/pmMonthRef';
import { recomputeOwnerMonthPayoutTotals } from '@/lib/ownerStatementTotals';
import { isPayoutClosed } from '@/lib/statementWriteGuard';

export type BillingDocForSync = BillingDocument & { items: BillingLineItem[] };

export type BillingStatementSyncResult = {
  ok: boolean;
  action?: 'created' | 'updated' | 'deleted' | 'unchanged' | 'none';
  skipped?:
    | 'closed'
    | 'guards'
    | 'not_bill'
    | 'cancelled'
    | 'no_property'
    | 'no_owner'
    | 'no_client'
    | 'none';
  payoutId?: string | null;
  lineItemId?: string | null;
  propertyId?: string | null;
  yearMonth?: string | null;
  lineType?: 'income' | 'expense' | null;
  provisional?: boolean;
};

const DESC_MAX = 300;
const BILLING_SOURCE = 'BILLING' as const;

function truncDescription(raw: string): string {
  const t = raw.trim();
  if (t.length <= DESC_MAX) return t;
  return t.slice(0, DESC_MAX);
}

function decStr(d: Decimal): string {
  return d.toFixed(2);
}

function decEq(a: Decimal, b: Decimal): boolean {
  return decStr(a) === decStr(b);
}

function tsEq(a: Date | null, b: Date | null): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return a.getTime() === b.getTime();
}

function dayOfMonthUtc(d: Date): number {
  return d.getUTCDate();
}

function yearMonthFromIssueDate(issueDate: Date): string {
  const y = issueDate.getUTCFullYear();
  const m = String(issueDate.getUTCMonth() + 1).padStart(2, '0');
  return normalizeYearMonthForWrite(`${y}-${m}`) ?? `${y}-${m}`;
}

function billingOwnerLineType(
  creditParty: string | null | undefined,
  debitParty: string | null | undefined
): 'expense' | 'income' | null {
  const credit = String(creditParty || '').trim().toUpperCase();
  const debit = String(debitParty || '').trim().toUpperCase();
  if (debit === 'OWNER') return 'expense';
  if (credit === 'OWNER') return 'income';
  return null;
}

function shouldBillingSyncToStatement(doc: BillingDocForSync): boolean {
  if (String(doc.docType).toUpperCase() !== 'BILL') return false;
  if (!String(doc.propertyId || '').trim()) return false;
  if (String(doc.status || '').toUpperCase() === 'CANCELLED') return false;
  return billingOwnerLineType(doc.creditParty, doc.debitParty) !== null;
}

function billingLineDescription(doc: Pick<BillingDocument, 'number' | 'contactName'>): string {
  const num = String(doc.number || '').trim();
  const name = String(doc.contactName || '').trim();
  const raw = num ? `Bill ${num} — ${name}` : `Bill — ${name}`;
  return truncDescription(raw);
}

async function resolveClientId(
  doc: BillingDocForSync,
  propertyId: string
): Promise<string | null> {
  if (doc.clientId) return doc.clientId;
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { clientId: true },
  });
  return property?.clientId ?? null;
}

async function writeBillingSyncAudit(
  tx: Prisma.TransactionClient,
  args: {
    actorId: string;
    payoutId: string;
    clientId: string | null;
    details: Record<string, unknown>;
  }
) {
  const actor = await tx.user.findUnique({
    where: { id: args.actorId },
    select: { email: true },
  });
  await tx.auditEntry.create({
    data: {
      actorId: args.actorId,
      actorEmail: actor?.email ?? null,
      action: 'owner_statement.billing_sync',
      entity: 'OwnerMonthPayout',
      entityId: args.payoutId,
      clientId: args.clientId,
      details: JSON.stringify(args.details),
    },
  });
}

/**
 * Remove line item BILLING vinculado ao BillingDocument (cancelamento ou guards).
 * Respeita trava de fechamento — não remove se payout fechado.
 */
export async function removeBillingStatementLineItem(args: {
  billingDocumentId: string;
  actorId: string;
}): Promise<BillingStatementSyncResult> {
  const existing = await prisma.statementLineItem.findFirst({
    where: { source: BILLING_SOURCE, sourceRefId: args.billingDocumentId },
    include: {
      ownerMonthPayout: {
        select: { id: true, closedAt: true, clientId: true, propertyId: true, yearMonth: true },
      },
    },
  });

  if (!existing) {
    return { ok: true, action: 'none', skipped: 'none' };
  }

  const payout = existing.ownerMonthPayout;
  if (isPayoutClosed(payout)) {
    return {
      ok: false,
      skipped: 'closed',
      payoutId: payout.id,
      lineItemId: existing.id,
      propertyId: payout.propertyId,
      yearMonth: payout.yearMonth,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.statementLineItem.delete({ where: { id: existing.id } });
    await recomputeOwnerMonthPayoutTotals(payout.id, tx);
    await writeBillingSyncAudit(tx, {
      actorId: args.actorId,
      payoutId: payout.id,
      clientId: payout.clientId,
      details: {
        billingDocumentId: args.billingDocumentId,
        action: 'deleted',
        lineItemId: existing.id,
      },
    });
  });

  return {
    ok: true,
    action: 'deleted',
    payoutId: payout.id,
    lineItemId: existing.id,
    propertyId: payout.propertyId,
    yearMonth: payout.yearMonth,
  };
}

/**
 * Cria ou atualiza line item no Owner Statement a partir de um Bill (provisional até PAID).
 * Idempotente por sourceRefId = billingDocument.id + source = BILLING.
 */
export async function billingStatementSync(args: {
  document: BillingDocForSync;
  actorId: string;
}): Promise<BillingStatementSyncResult> {
  const doc = args.document;

  if (String(doc.docType).toUpperCase() !== 'BILL') {
    return { ok: true, skipped: 'not_bill', action: 'none' };
  }

  if (!shouldBillingSyncToStatement(doc)) {
    const removed = await removeBillingStatementLineItem({
      billingDocumentId: doc.id,
      actorId: args.actorId,
    });
    if (removed.skipped === 'closed') return removed;
    const skipped =
      String(doc.status || '').toUpperCase() === 'CANCELLED'
        ? 'cancelled'
        : !String(doc.propertyId || '').trim()
          ? 'no_property'
          : 'no_owner';
    return {
      ...removed,
      skipped: removed.action === 'deleted' ? undefined : skipped,
    };
  }

  const propertyId = String(doc.propertyId!).trim();
  const yearMonth = yearMonthFromIssueDate(doc.issueDate);
  const lineType = billingOwnerLineType(doc.creditParty, doc.debitParty)!;
  const provisional = String(doc.status || '').toUpperCase() !== 'PAID';
  const description = billingLineDescription(doc);
  const sortOrder = dayOfMonthUtc(doc.issueDate) * 10 + 3;
  const transactionDate = doc.issueDate;

  const targetPayoutPreview = await prisma.ownerMonthPayout.findUnique({
    where: { propertyId_yearMonth: { propertyId, yearMonth } },
    select: { id: true, closedAt: true },
  });
  if (isPayoutClosed(targetPayoutPreview)) {
    return {
      ok: false,
      skipped: 'closed',
      payoutId: targetPayoutPreview?.id ?? null,
      propertyId,
      yearMonth,
    };
  }

  const existingLine = await prisma.statementLineItem.findFirst({
    where: { source: BILLING_SOURCE, sourceRefId: doc.id },
    include: {
      ownerMonthPayout: {
        select: { id: true, closedAt: true, propertyId: true, yearMonth: true, clientId: true },
      },
    },
  });

  if (existingLine) {
    const oldPayout = existingLine.ownerMonthPayout;
    const samePayout =
      oldPayout.propertyId === propertyId && oldPayout.yearMonth === yearMonth;
    if (!samePayout && isPayoutClosed(oldPayout)) {
      return {
        ok: false,
        skipped: 'closed',
        payoutId: oldPayout.id,
        lineItemId: existingLine.id,
        propertyId: oldPayout.propertyId,
        yearMonth: oldPayout.yearMonth,
      };
    }
  }

  const clientId = await resolveClientId(doc, propertyId);
  if (!clientId) {
    return { ok: false, skipped: 'no_client', propertyId, yearMonth };
  }

  let action: 'created' | 'updated' | 'unchanged' = 'unchanged';
  let lineItemId: string | null = existingLine?.id ?? null;
  let payoutId: string | null = null;

  await prisma.$transaction(async (tx) => {
    const payout = await tx.ownerMonthPayout.upsert({
      where: { propertyId_yearMonth: { propertyId, yearMonth } },
      create: {
        propertyId,
        yearMonth,
        clientId,
        totalIncome: new Prisma.Decimal(0),
        totalExpenses: new Prisma.Decimal(0),
        netPayout: new Prisma.Decimal(0),
      },
      update: { clientId },
    });
    payoutId = payout.id;

    if (existingLine && existingLine.ownerMonthPayoutId !== payout.id) {
      const oldPayoutId = existingLine.ownerMonthPayoutId;
      await tx.statementLineItem.delete({ where: { id: existingLine.id } });
      await recomputeOwnerMonthPayoutTotals(oldPayoutId, tx);
      lineItemId = null;
    }

    const onPayout = await tx.statementLineItem.findUnique({
      where: {
        uniq_line_item_source: {
          ownerMonthPayoutId: payout.id,
          source: BILLING_SOURCE,
          sourceRefId: doc.id,
        },
      },
    });

    const data = {
      ownerMonthPayoutId: payout.id,
      lineType,
      description,
      amount: doc.total,
      sortOrder,
      clientId,
      source: BILLING_SOURCE,
      sourceRefId: doc.id,
      transactionDate,
      provisional,
    };

    if (!onPayout) {
      const created = await tx.statementLineItem.create({ data });
      lineItemId = created.id;
      action = 'created';
    } else if (
      onPayout.lineType === data.lineType &&
      onPayout.description === data.description &&
      decEq(onPayout.amount, doc.total) &&
      onPayout.sortOrder === data.sortOrder &&
      onPayout.clientId === data.clientId &&
      onPayout.provisional === data.provisional &&
      tsEq(onPayout.transactionDate, data.transactionDate)
    ) {
      lineItemId = onPayout.id;
      action = 'unchanged';
    } else {
      await tx.statementLineItem.update({
        where: { id: onPayout.id },
        data: {
          lineType: data.lineType,
          description: data.description,
          amount: data.amount,
          sortOrder: data.sortOrder,
          clientId: data.clientId,
          transactionDate: data.transactionDate,
          provisional: data.provisional,
        },
      });
      lineItemId = onPayout.id;
      action = 'updated';
    }

    if (existingLine && existingLine.ownerMonthPayoutId !== payout.id && action === 'created') {
      action = 'updated';
    }

    await recomputeOwnerMonthPayoutTotals(payout.id, tx);

    await writeBillingSyncAudit(tx, {
      actorId: args.actorId,
      payoutId: payout.id,
      clientId,
      details: {
        billingDocumentId: doc.id,
        action,
        lineItemId,
        propertyId,
        yearMonth,
        lineType,
        provisional,
        amount: decStr(doc.total),
        creditParty: doc.creditParty,
        debitParty: doc.debitParty,
        status: doc.status,
      },
    });
  });

  return {
    ok: true,
    action,
    payoutId,
    lineItemId,
    propertyId,
    yearMonth,
    lineType,
    provisional,
  };
}
