import { Prisma } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/db';
import { monthRefQueryValues, normalizeYearMonthForWrite } from '@/lib/pmMonthRef';

export type SyncOwnerStatementResult = {
  payoutId: string;
  created: number;
  updated: number;
  skipped: number;
  totalIncome: string;
  totalExpenses: string;
  netPayout: string;
};

const DESC_MAX = 300;

function truncDescription(raw: string): string {
  const t = raw.trim();
  if (t.length <= DESC_MAX) return t;
  return t.slice(0, DESC_MAX);
}

function monthBoundsUtc(yearMonth: string): { start: Date; end: Date } | null {
  const norm = normalizeYearMonthForWrite(yearMonth);
  if (!norm) return null;
  const [ys, ms] = norm.split('-');
  const y = Number(ys);
  const mo = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(mo)) return null;
  const start = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, mo, 0, 23, 59, 59, 999));
  return { start, end };
}

function rentalDescription(type: string | null | undefined): string {
  const t = type?.trim();
  if (!t || t.toLowerCase() === 'rent') return 'Rental Income';
  return truncDescription(`Rental Income — ${t}`);
}

function dayOfMonthUtc(d: Date): number {
  return d.getUTCDate();
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

/**
 * Materializa line-items AUTO_RENTAL / AUTO_EXPENSE a partir de TenantPayment e PmExpense (só leitura nas fontes).
 * Linhas MANUAL / CSV_UPLOAD não são alteradas. Idempotente via unique (ownerMonthPayoutId, source, sourceRefId).
 */
export async function syncOwnerStatementForProperty(args: {
  propertyId: string;
  yearMonth: string;
  clientId: string;
  actorId: string;
}): Promise<SyncOwnerStatementResult> {
  const normalizedYm = normalizeYearMonthForWrite(args.yearMonth);
  if (!normalizedYm) {
    throw new Error('INVALID_YEAR_MONTH');
  }

  const bounds = monthBoundsUtc(normalizedYm);
  if (!bounds) {
    throw new Error('INVALID_YEAR_MONTH');
  }

  const property = await prisma.property.findUnique({
    where: { id: args.propertyId },
    select: { id: true, clientId: true },
  });
  if (!property) {
    throw new Error('PROPERTY_NOT_FOUND');
  }

  if (property.clientId != null && property.clientId !== args.clientId) {
    throw new Error('CLIENT_MISMATCH');
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  const { payoutId, totalIncome, totalExpenses, netPayout } = await prisma.$transaction(async (tx) => {
    const payout = await tx.ownerMonthPayout.upsert({
      where: {
        propertyId_yearMonth: { propertyId: args.propertyId, yearMonth: normalizedYm },
      },
      create: {
        propertyId: args.propertyId,
        yearMonth: normalizedYm,
        clientId: args.clientId,
        totalIncome: new Prisma.Decimal(0),
        totalExpenses: new Prisma.Decimal(0),
        netPayout: new Prisma.Decimal(0),
      },
      update: {
        clientId: args.clientId,
      },
    });

    const tenantPayments = await tx.tenantPayment.findMany({
      where: {
        propertyId: args.propertyId,
        clientId: args.clientId,
        cashAccount: { startsWith: '1150' },
        paymentDate: { gte: bounds.start, lte: bounds.end },
      },
      select: {
        id: true,
        type: true,
        receiptAmount: true,
        paymentDate: true,
      },
    });

    for (const tp of tenantPayments) {
      const description = rentalDescription(tp.type);
      const sortOrder = dayOfMonthUtc(tp.paymentDate) * 10;
      const existing = await tx.statementLineItem.findUnique({
        where: {
          uniq_line_item_source: {
            ownerMonthPayoutId: payout.id,
            source: 'AUTO_RENTAL',
            sourceRefId: tp.id,
          },
        },
      });
      const data = {
        ownerMonthPayoutId: payout.id,
        lineType: 'income',
        description,
        amount: tp.receiptAmount,
        sortOrder,
        clientId: args.clientId,
        source: 'AUTO_RENTAL' as const,
        sourceRefId: tp.id,
        transactionDate: tp.paymentDate,
      };
      if (!existing) {
        await tx.statementLineItem.create({ data });
        created++;
      } else if (
        existing.description === data.description &&
        decEq(existing.amount, tp.receiptAmount) &&
        existing.sortOrder === data.sortOrder &&
        existing.lineType === data.lineType &&
        existing.clientId === data.clientId &&
        tsEq(existing.transactionDate, data.transactionDate)
      ) {
        skipped++;
      } else {
        await tx.statementLineItem.update({
          where: { id: existing.id },
          data: {
            description: data.description,
            amount: data.amount,
            sortOrder: data.sortOrder,
            lineType: data.lineType,
            clientId: data.clientId,
            transactionDate: data.transactionDate,
          },
        });
        updated++;
      }
    }

    const monthVals = monthRefQueryValues(normalizedYm);
    const expenses = await tx.pmExpense.findMany({
      where: {
        propertyId: args.propertyId,
        clientId: args.clientId,
        monthRef: { in: monthVals },
        status: { not: 'CANCELLED' },
      },
      select: {
        id: true,
        description: true,
        serviceType: true,
        ownerCharged: true,
        serviceDate: true,
        createdAt: true,
      },
    });

    for (const ex of expenses) {
      const rawDesc = ex.description?.trim() || ex.serviceType?.trim() || 'Expense';
      const description = truncDescription(rawDesc);
      const txDate = ex.serviceDate ?? ex.createdAt;
      const sortOrder = dayOfMonthUtc(txDate) * 10 + 5;
      const existing = await tx.statementLineItem.findUnique({
        where: {
          uniq_line_item_source: {
            ownerMonthPayoutId: payout.id,
            source: 'AUTO_EXPENSE',
            sourceRefId: ex.id,
          },
        },
      });
      const data = {
        ownerMonthPayoutId: payout.id,
        lineType: 'expense',
        description,
        amount: ex.ownerCharged,
        sortOrder,
        clientId: args.clientId,
        source: 'AUTO_EXPENSE' as const,
        sourceRefId: ex.id,
        transactionDate: ex.serviceDate ?? ex.createdAt,
      };
      if (!existing) {
        await tx.statementLineItem.create({ data });
        created++;
      } else if (
        existing.description === data.description &&
        decEq(existing.amount, ex.ownerCharged) &&
        existing.sortOrder === data.sortOrder &&
        existing.lineType === data.lineType &&
        existing.clientId === data.clientId &&
        tsEq(existing.transactionDate, data.transactionDate)
      ) {
        skipped++;
      } else {
        await tx.statementLineItem.update({
          where: { id: existing.id },
          data: {
            description: data.description,
            amount: data.amount,
            sortOrder: data.sortOrder,
            lineType: data.lineType,
            clientId: data.clientId,
            transactionDate: data.transactionDate,
          },
        });
        updated++;
      }
    }

    const allLines = await tx.statementLineItem.findMany({
      where: { ownerMonthPayoutId: payout.id },
      select: { lineType: true, amount: true },
    });

    let inc = new Prisma.Decimal(0);
    let exp = new Prisma.Decimal(0);
    for (const li of allLines) {
      if (li.lineType === 'income') inc = inc.add(li.amount);
      else if (li.lineType === 'expense') exp = exp.add(li.amount);
    }
    const net = inc.sub(exp);

    await tx.ownerMonthPayout.update({
      where: { id: payout.id },
      data: {
        totalIncome: inc,
        totalExpenses: exp,
        netPayout: net,
      },
    });

    const actor = await tx.user.findUnique({
      where: { id: args.actorId },
      select: { email: true },
    });

    await tx.auditEntry.create({
      data: {
        actorId: args.actorId,
        actorEmail: actor?.email ?? null,
        action: 'owner_statement.sync',
        entity: 'OwnerMonthPayout',
        entityId: payout.id,
        clientId: args.clientId,
        details: JSON.stringify({
          propertyId: args.propertyId,
          yearMonth: normalizedYm,
          created,
          updated,
          skipped,
          totalIncome: decStr(inc),
          totalExpenses: decStr(exp),
          netPayout: decStr(net),
        }),
      },
    });

    return {
      payoutId: payout.id,
      totalIncome: inc,
      totalExpenses: exp,
      netPayout: net,
    };
  });

  return {
    payoutId,
    created,
    updated,
    skipped,
    totalIncome: decStr(totalIncome),
    totalExpenses: decStr(totalExpenses),
    netPayout: decStr(netPayout),
  };
}
