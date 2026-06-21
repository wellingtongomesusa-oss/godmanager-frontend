import type { HoaCharge, HoaInstallment } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { normalizeYearMonthForWrite } from '@/lib/pmMonthRef';
import { syncOwnerStatementForProperty } from '@/lib/ownerStatementSync';
import {
  addMonthsToDate,
  decToNum,
  fetchPropertySnapshots,
  moneyStr,
  parseOptionalDate,
  roundMoney,
  type PropertySnapshot,
} from '@/lib/loanBilling';

export type HoaChargeWithInstallments = HoaCharge & { installments: HoaInstallment[] };

export { fetchPropertySnapshots, parseOptionalDate, type PropertySnapshot };

/** Parcelas com valor fixo mensal (monthlyAmount); dueDate = startDate + (seq-1) meses UTC. */
export function buildHoaInstallments(args: {
  monthlyAmount: Prisma.Decimal | number;
  installmentsCount: number;
  startDate: Date;
}): { seq: number; dueDate: Date; amount: number }[] {
  const count = args.installmentsCount;
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('installmentsCount must be an integer >= 1');
  }
  const amount = roundMoney(
    typeof args.monthlyAmount === 'number'
      ? args.monthlyAmount
      : decToNum(args.monthlyAmount),
  );
  const rows: { seq: number; dueDate: Date; amount: number }[] = [];
  for (let seq = 1; seq <= count; seq++) {
    rows.push({
      seq,
      dueDate: addMonthsToDate(args.startDate, seq - 1),
      amount,
    });
  }
  return rows;
}

export function summarizeHoaInstallments(installments: HoaInstallment[]) {
  let totalNum = 0;
  let paidTotalNum = 0;
  let paidCount = 0;
  for (const i of installments) {
    totalNum += decToNum(i.amount);
    if (i.paid) {
      paidCount++;
      paidTotalNum +=
        i.paidAmount != null ? decToNum(i.paidAmount) : decToNum(i.amount);
    }
  }
  totalNum = roundMoney(totalNum);
  paidTotalNum = roundMoney(paidTotalNum);
  const outstandingNum = roundMoney(totalNum - paidTotalNum);
  return {
    total: moneyStr(totalNum),
    paidTotal: moneyStr(paidTotalNum),
    outstanding: moneyStr(outstandingNum),
    paidCount,
    totalCount: installments.length,
  };
}

export function hoaInstallmentToJson(item: HoaInstallment) {
  return {
    id: item.id,
    hoaChargeId: item.hoaChargeId,
    clientId: item.clientId,
    seq: item.seq,
    dueDate: item.dueDate.toISOString(),
    amount: moneyStr(item.amount),
    paid: item.paid,
    paidAt: item.paidAt ? item.paidAt.toISOString() : null,
    paidAmount: item.paidAmount != null ? moneyStr(item.paidAmount) : null,
    pmExpenseId: item.pmExpenseId,
    notes: item.notes,
  };
}

export function hoaChargeToJson(
  charge: HoaChargeWithInstallments,
  opts?: {
    property?: PropertySnapshot | null;
    installmentSummary?: ReturnType<typeof summarizeHoaInstallments>;
    includeInstallments?: boolean;
  },
) {
  const sorted = charge.installments.slice().sort((a, b) => a.seq - b.seq);
  const summary = opts?.installmentSummary ?? summarizeHoaInstallments(sorted);
  const includeInstallments = opts?.includeInstallments ?? true;
  return {
    id: charge.id,
    clientId: charge.clientId,
    propertyId: charge.propertyId,
    code: charge.code,
    hoaName: charge.hoaName,
    debtorName: charge.debtorName,
    monthlyAmount: moneyStr(charge.monthlyAmount),
    installmentsCount: charge.installmentsCount,
    startDate: charge.startDate.toISOString(),
    notes: charge.notes,
    status: charge.status,
    createdById: charge.createdById,
    createdAt: charge.createdAt.toISOString(),
    updatedAt: charge.updatedAt.toISOString(),
    installmentSummary: summary,
    installments: includeInstallments
      ? sorted.map((i) => hoaInstallmentToJson(i))
      : undefined,
    property: opts?.property ?? null,
  };
}

export async function nextHoaCode(
  tx: Prisma.TransactionClient,
  clientId: string | null,
): Promise<string> {
  const prefix = 'HOA-';
  const latest = await tx.hoaCharge.findFirst({
    where: {
      ...(clientId ? { clientId } : { clientId: null }),
    },
    orderBy: { code: 'desc' },
    select: { code: true },
  });

  let next = 1;
  if (latest?.code) {
    const match = latest.code.match(/\d+/);
    if (match) {
      next = parseInt(match[0], 10) + 1;
    }
  }

  return `${prefix}${String(next).padStart(4, '0')}`;
}

export async function syncHoaChargeStatusFromInstallments(
  tx: Prisma.TransactionClient,
  chargeId: string,
): Promise<string> {
  const charge = await tx.hoaCharge.findUnique({
    where: { id: chargeId },
    select: { status: true },
  });
  if (!charge) return 'active';
  if (charge.status === 'cancelled') return 'cancelled';

  const installments = await tx.hoaInstallment.findMany({
    where: { hoaChargeId: chargeId },
    select: { paid: true },
  });
  const allPaid =
    installments.length > 0 && installments.every((i) => i.paid);
  const newStatus = allPaid ? 'paid' : 'active';
  if (charge.status !== newStatus) {
    await tx.hoaCharge.update({
      where: { id: chargeId },
      data: { status: newStatus },
    });
  }
  return newStatus;
}

/** Civil calendar month YYYY-MM from dueDate (UTC). Not the PM 15–15 cycle. */
export function civilMonthRefFromDueDate(dueDate: Date): string {
  const y = dueDate.getUTCFullYear();
  const m = dueDate.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function hoaInstallmentExpenseDescription(chargeCode: string, seq: number): string {
  return `HOA ${String(chargeCode || '').trim()} parcela ${seq}`;
}

function hoaPmExpenseMoney(amount: number): Prisma.Decimal {
  return new Prisma.Decimal(roundMoney(amount).toFixed(2));
}

/**
 * Ensure a FINALIZED pm_expense exists for a paid HOA installment (idempotent).
 * Returns pm_expense id to store on the installment.
 */
export async function ensureHoaInstallmentPmExpense(
  tx: Prisma.TransactionClient,
  args: {
    installment: HoaInstallment;
    charge: HoaCharge;
  },
): Promise<string> {
  const propertyId = args.charge.propertyId;
  if (!propertyId) {
    throw new Error('HOA charge has no propertyId');
  }
  const amount = roundMoney(decToNum(args.installment.amount));
  const monthRef =
    normalizeYearMonthForWrite(civilMonthRefFromDueDate(args.installment.dueDate)) ??
    civilMonthRefFromDueDate(args.installment.dueDate);
  const description = hoaInstallmentExpenseDescription(args.charge.code, args.installment.seq);
  const metadata = {
    hoaInstallmentId: args.installment.id,
    hoaChargeId: args.charge.id,
  };
  const money = hoaPmExpenseMoney(amount);
  const clientId = args.installment.clientId ?? args.charge.clientId;
  const now = new Date();

  const expenseData = {
    propertyId,
    clientId,
    vendorId: null,
    serviceType: 'HOA',
    packageApplied: 'PACOTE_4' as const,
    vendorCost: money,
    ownerCharged: money,
    serviceDate: args.installment.dueDate,
    monthRef,
    status: 'FINALIZED' as const,
    description,
    metadata,
    isVendorFree: true,
    finalizedAt: now,
  };

  const linkedId = args.installment.pmExpenseId;
  if (linkedId) {
    const existing = await tx.pmExpense.findUnique({
      where: { id: linkedId },
      select: { id: true, status: true },
    });
    if (existing && existing.status !== 'CANCELLED') {
      return existing.id;
    }
    if (existing && existing.status === 'CANCELLED') {
      await tx.pmExpense.update({
        where: { id: existing.id },
        data: expenseData,
      });
      return existing.id;
    }
  }

  const created = await tx.pmExpense.create({ data: expenseData });
  return created.id;
}

/** Soft-cancel linked pm_expense (never delete). */
export async function cancelHoaInstallmentPmExpense(
  tx: Prisma.TransactionClient,
  pmExpenseId: string | null | undefined,
): Promise<void> {
  if (!pmExpenseId) return;
  const existing = await tx.pmExpense.findUnique({
    where: { id: pmExpenseId },
    select: { id: true, status: true },
  });
  if (!existing || existing.status === 'CANCELLED') return;
  await tx.pmExpense.update({
    where: { id: existing.id },
    data: { status: 'CANCELLED' },
  });
}

export async function syncOwnerStatementForHoaInstallment(args: {
  propertyId: string;
  dueDate: Date;
  clientId: string | null;
  scopeClientId: string | null | undefined;
  actorId: string;
}): Promise<void> {
  let syncClientId = args.clientId ?? args.scopeClientId ?? null;
  if (!syncClientId) return;
  const yearMonth = civilMonthRefFromDueDate(args.dueDate);
  await syncOwnerStatementForProperty({
    propertyId: args.propertyId,
    yearMonth,
    clientId: syncClientId,
    actorId: args.actorId,
  });
}
