import type { HoaCharge, HoaInstallment, Prisma } from '@prisma/client';
import type { ClientScopeUser } from '@/lib/clientScope';
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
