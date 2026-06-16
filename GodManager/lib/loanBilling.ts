import type { Loan, LoanInstallment, Prisma } from '@prisma/client';
import type { ClientScopeUser } from '@/lib/clientScope';
import { getClientScopeWhere } from '@/lib/clientScope';
import { prisma } from '@/lib/db';

export type LoanWithInstallments = Loan & { installments: LoanInstallment[] };

export function decToNum(v: Prisma.Decimal | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

export function moneyStr(v: Prisma.Decimal | number | null | undefined): string {
  const n = typeof v === 'number' ? v : decToNum(v);
  return n.toFixed(2);
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Parcelas em centavos; última absorve resto — Σ == principal. */
export function buildInstallmentAmounts(principal: number, count: number): number[] {
  const totalCents = Math.round(principal * 100);
  const base = Math.floor(totalCents / count);
  const amounts: number[] = [];
  for (let seq = 1; seq <= count; seq++) {
    const cents = seq === count ? totalCents - base * (count - 1) : base;
    amounts.push(cents / 100);
  }
  return amounts;
}

export function addMonthsToDate(base: Date, months: number): Date {
  const d = new Date(base.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

export function parseOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

/** UTC calendar day (no time) for date-only comparisons. */
export function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function utcTodayStart(): Date {
  const now = new Date();
  return utcDayStart(now);
}

export function daysBetweenUtcDates(later: Date, earlier: Date): number {
  const ms = utcDayStart(later).getTime() - utcDayStart(earlier).getTime();
  return Math.floor(ms / 86400000);
}

export function installmentOverdueDays(
  item: Pick<LoanInstallment, 'dueDate' | 'paid'>,
  today?: Date
): number {
  if (item.paid) return 0;
  const todayStart = today ? utcDayStart(today) : utcTodayStart();
  const due = utcDayStart(item.dueDate);
  if (due.getTime() >= todayStart.getTime()) return 0;
  return daysBetweenUtcDates(todayStart, due);
}

export function computeOverdueMetrics(
  installments: Pick<LoanInstallment, 'dueDate' | 'paid'>[],
  today?: Date
) {
  const todayStart = today ? utcDayStart(today) : utcTodayStart();
  let overdueCount = 0;
  let earliestOverdue: Date | null = null;
  for (const i of installments) {
    if (i.paid) continue;
    const due = utcDayStart(i.dueDate);
    if (due.getTime() < todayStart.getTime()) {
      overdueCount++;
      if (!earliestOverdue || due.getTime() < earliestOverdue.getTime()) {
        earliestOverdue = due;
      }
    }
  }
  const overdueDays =
    earliestOverdue != null ? daysBetweenUtcDates(todayStart, earliestOverdue) : 0;
  return { overdueCount, overdueDays };
}

export function installmentToJson(item: LoanInstallment, today?: Date) {
  const overdueDays = installmentOverdueDays(item, today);
  return {
    id: item.id,
    loanId: item.loanId,
    clientId: item.clientId,
    seq: item.seq,
    dueDate: item.dueDate.toISOString(),
    amount: moneyStr(item.amount),
    paid: item.paid,
    paidAt: item.paidAt ? item.paidAt.toISOString() : null,
    paidAmount: item.paidAmount != null ? moneyStr(item.paidAmount) : null,
    notes: item.notes,
    createdAt: item.createdAt.toISOString(),
    overdueDays,
  };
}

export function summarizeInstallments(
  installments: LoanInstallment[],
  principal: Prisma.Decimal,
  today?: Date
) {
  const principalNum = decToNum(principal);
  let paidCount = 0;
  let totalPaid = 0;
  for (const i of installments) {
    if (i.paid) {
      paidCount++;
      totalPaid += i.paidAmount != null ? decToNum(i.paidAmount) : decToNum(i.amount);
    }
  }
  totalPaid = roundMoney(totalPaid);
  const overdue = computeOverdueMetrics(installments, today);
  return {
    totalCount: installments.length,
    paidCount,
    totalPaid: moneyStr(totalPaid),
    remaining: moneyStr(roundMoney(principalNum - totalPaid)),
    overdueCount: overdue.overdueCount,
    overdueDays: overdue.overdueDays,
  };
}

export type PropertySnapshot = { id: string; code: string; address: string };

export function loanToJson(
  loan: LoanWithInstallments,
  opts?: {
    property?: PropertySnapshot | null;
    installmentSummary?: ReturnType<typeof summarizeInstallments>;
    today?: Date;
  }
) {
  const today = opts?.today;
  const summary =
    opts?.installmentSummary ?? summarizeInstallments(loan.installments, loan.principal, today);
  return {
    id: loan.id,
    clientId: loan.clientId,
    propertyId: loan.propertyId,
    code: loan.code,
    debtorName: loan.debtorName,
    guarantorName: loan.guarantorName,
    creditorName: loan.creditorName,
    guarantorEmail: loan.guarantorEmail,
    guarantorPhone: loan.guarantorPhone,
    principal: moneyStr(loan.principal),
    interestRate: loan.interestRate != null ? moneyStr(loan.interestRate) : null,
    startDate: loan.startDate.toISOString(),
    installmentsCount: loan.installmentsCount,
    notes: loan.notes,
    status: loan.status,
    createdById: loan.createdById,
    createdAt: loan.createdAt.toISOString(),
    updatedAt: loan.updatedAt.toISOString(),
    installments: loan.installments
      .slice()
      .sort((a, b) => a.seq - b.seq)
      .map((i) => installmentToJson(i, today)),
    installmentSummary: summary,
    overdueCount: summary.overdueCount,
    overdueDays: summary.overdueDays,
    property: opts?.property ?? null,
  };
}

export async function nextLoanCode(
  tx: Prisma.TransactionClient,
  clientId: string | null
): Promise<string> {
  const prefix = 'LOAN-';
  const latest = await tx.loan.findFirst({
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

export async function fetchPropertySnapshots(
  scopeUser: ClientScopeUser,
  propertyIds: string[]
): Promise<Map<string, PropertySnapshot>> {
  const ids = [...new Set(propertyIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await prisma.property.findMany({
    where: { id: { in: ids }, ...getClientScopeWhere(scopeUser) },
    select: { id: true, code: true, address: true },
  });
  return new Map(rows.map((p) => [p.id, p]));
}

export async function syncLoanStatusFromInstallments(
  tx: Prisma.TransactionClient,
  loanId: string
): Promise<string> {
  const loan = await tx.loan.findUnique({
    where: { id: loanId },
    select: { status: true },
  });
  if (!loan) return 'active';
  if (loan.status === 'cancelled') return 'cancelled';

  const installments = await tx.loanInstallment.findMany({
    where: { loanId },
    select: { paid: true },
  });
  const allPaid =
    installments.length > 0 && installments.every((i) => i.paid);
  const newStatus = allPaid ? 'paid' : 'active';
  if (loan.status !== newStatus) {
    await tx.loan.update({
      where: { id: loanId },
      data: { status: newStatus },
    });
  }
  return newStatus;
}
