import type { LeaseContract, Property, RentInvoice, RentInvoiceItem } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { decToNum, moneyStr, roundMoney, utcDayStart, utcTodayStart } from '@/lib/loanBilling';

export type RentInvoiceItemInput = { label: string; amount: number; sortOrder: number };

export type RentInvoiceWithItems = RentInvoice & { items: RentInvoiceItem[] };

export type TenantPaymentMatchRow = {
  receiptAmount: Prisma.Decimal | number;
  paymentDate: Date;
};

export type RecomputedInvoice = {
  status: string;
  paidAmount: number | null;
  paidAt: Date | null;
  lateFeeAmount: number;
};

/** Human label: {propertyCode}{MM}{YYYY} from yearMonth YYYY-MM. */
export function rentInvoiceCode(propertyCode: string, yearMonth: string): string {
  const parts = String(yearMonth || '').trim().split('-');
  const yyyy = parts[0] ?? '';
  const mm = (parts[1] ?? '').padStart(2, '0');
  return `${String(propertyCode || '').trim()}${mm}${yyyy}`;
}

export function yearMonthFromDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function utcCurrentYearMonth(): string {
  return yearMonthFromDate(new Date());
}

export function parseYearMonth(value: unknown): string | undefined {
  const s = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}$/.test(s)) return undefined;
  const month = Number(s.slice(5, 7));
  if (month < 1 || month > 12) return undefined;
  return s;
}

export function addYearMonth(ym: string, months: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return yearMonthFromDate(d);
}

/** Inclusive list of YYYY-MM from fromYm through toYm. */
export function monthsRange(fromYm: string, toYm: string): string[] {
  if (fromYm > toYm) return [];
  const out: string[] = [];
  let cur = fromYm;
  while (cur <= toYm) {
    out.push(cur);
    cur = addYearMonth(cur, 1);
  }
  return out;
}

export function dueDateFirstOfMonthUtc(yearMonth: string): Date {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

export function resolveContractRentDeposit(
  contract: Pick<LeaseContract, 'monthlyRent' | 'deposit'>,
  property: Pick<Property, 'rent' | 'deposit'>,
): { monthlyRent: number; deposit: number } {
  const fromContractRent =
    contract.monthlyRent != null ? decToNum(contract.monthlyRent) : null;
  const fromContractDep =
    contract.deposit != null ? decToNum(contract.deposit) : null;
  return {
    monthlyRent:
      fromContractRent != null && fromContractRent > 0
        ? fromContractRent
        : decToNum(property.rent),
    deposit: fromContractDep != null ? fromContractDep : decToNum(property.deposit),
  };
}

function prorateFirstMonthRent(monthlyRent: number, moveInDate: Date): number {
  const y = moveInDate.getUTCFullYear();
  const m = moveInDate.getUTCMonth();
  const day = moveInDate.getUTCDate();
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const daysFromMoveInThroughEnd = daysInMonth - day + 1;
  return roundMoney((monthlyRent * daysFromMoveInThroughEnd) / daysInMonth);
}

export function buildMoveInItems(
  rent: number,
  deposit: number,
  prorate?: boolean,
  moveInDate?: Date,
): RentInvoiceItemInput[] {
  const firstRent =
    prorate && moveInDate ? prorateFirstMonthRent(rent, moveInDate) : roundMoney(rent);
  const items: RentInvoiceItemInput[] = [
    { label: '1o Aluguel', amount: firstRent, sortOrder: 0 },
    { label: 'Deposito', amount: roundMoney(deposit), sortOrder: 1 },
  ];
  return items;
}

export function rentInvoiceToJson(inv: RentInvoice, items: RentInvoiceItem[]) {
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    id: inv.id,
    clientId: inv.clientId,
    contractId: inv.contractId,
    propertyId: inv.propertyId,
    code: inv.code,
    type: inv.type,
    monthRef: inv.monthRef,
    dueDate: inv.dueDate.toISOString(),
    amount: moneyStr(inv.amount),
    status: inv.status,
    paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
    paidAmount: inv.paidAmount != null ? moneyStr(inv.paidAmount) : null,
    lateFeeAmount: moneyStr(inv.lateFeeAmount),
    notes: inv.notes,
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
    items: sorted.map((i) => ({
      id: i.id,
      label: i.label,
      amount: moneyStr(i.amount),
      sortOrder: i.sortOrder,
    })),
  };
}

export function sumItemAmounts(items: RentInvoiceItemInput[]): number {
  return roundMoney(items.reduce((s, i) => s + i.amount, 0));
}

export function toDecimalAmount(n: number): Prisma.Decimal {
  return new Prisma.Decimal(roundMoney(n).toFixed(2));
}

/** Civil month bounds UTC for YYYY-MM (inclusive). */
export function monthBoundsUtc(yearMonth: string): { start: Date; end: Date } | null {
  const ym = parseYearMonth(yearMonth);
  if (!ym) return null;
  const [ys, ms] = ym.split('-');
  const y = Number(ys);
  const mo = Number(ms);
  const start = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, mo, 0, 23, 59, 59, 999));
  return { start, end };
}

export function paymentInMonthRef(paymentDate: Date, monthRef: string): boolean {
  const bounds = monthBoundsUtc(monthRef);
  if (!bounds) return false;
  const t = paymentDate.getTime();
  return t >= bounds.start.getTime() && t <= bounds.end.getTime();
}

function addDaysUtc(d: Date, days: number): Date {
  const base = utcDayStart(d);
  const r = new Date(base.getTime());
  r.setUTCDate(r.getUTCDate() + days);
  return utcDayStart(r);
}

/** Complete civil months from `from` through `to` (UTC calendar). */
export function civilMonthsComplete(fromDate: Date, asOf: Date): number {
  const from = utcDayStart(fromDate);
  const to = utcDayStart(asOf);
  if (to.getTime() <= from.getTime()) return 0;
  let months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

/**
 * Payments already filtered by property + civil month of invoice.
 * Sums receiptAmount; paid when sum >= invoice.amount.
 */
export function matchInvoicePaid(
  invoice: Pick<RentInvoice, 'amount'>,
  payments: TenantPaymentMatchRow[],
): { paid: boolean; paidAmount: number; paidAt: Date | null } {
  let sum = 0;
  let latestPaidAt: Date | null = null;
  for (const p of payments) {
    const amt =
      typeof p.receiptAmount === 'number' ? p.receiptAmount : decToNum(p.receiptAmount);
    sum = roundMoney(sum + amt);
    if (!latestPaidAt || p.paymentDate.getTime() > latestPaidAt.getTime()) {
      latestPaidAt = p.paymentDate;
    }
  }
  const amount = decToNum(invoice.amount);
  if (sum >= amount) {
    return { paid: true, paidAmount: sum, paidAt: latestPaidAt };
  }
  return { paid: false, paidAmount: sum > 0 ? sum : 0, paidAt: null };
}

export function computeLateFee(
  invoice: Pick<RentInvoice, 'amount' | 'dueDate'>,
  contract: Pick<LeaseContract, 'graceDays' | 'lateFeePct' | 'monthlyInterestPct'>,
  asOf?: Date,
): { overdue: boolean; lateFeeAmount: number; monthsLate: number } {
  const today = asOf ? utcDayStart(asOf) : utcTodayStart();
  const due = utcDayStart(invoice.dueDate);
  const graceEnd = addDaysUtc(due, contract.graceDays);

  if (today.getTime() <= graceEnd.getTime()) {
    return { overdue: false, lateFeeAmount: 0, monthsLate: 0 };
  }

  const monthsLate = civilMonthsComplete(due, today);
  const amount = decToNum(invoice.amount);
  const lateFeePct = decToNum(contract.lateFeePct);
  const monthlyInterestPct = decToNum(contract.monthlyInterestPct);
  const flatFee = roundMoney((lateFeePct / 100) * amount);
  const interest = roundMoney((monthlyInterestPct / 100) * amount * monthsLate);
  const lateFeeAmount = roundMoney(flatFee + interest);

  return { overdue: true, lateFeeAmount, monthsLate };
}

/** Recompute status/fees; never des-pays invoices already marked paid. */
export function recomputeInvoice(
  invoice: RentInvoice,
  contract: LeaseContract,
  payments: TenantPaymentMatchRow[],
  asOf?: Date,
): RecomputedInvoice {
  if (invoice.status === 'paid') {
    return {
      status: 'paid',
      paidAmount:
        invoice.paidAmount != null ? decToNum(invoice.paidAmount) : decToNum(invoice.amount),
      paidAt: invoice.paidAt,
      lateFeeAmount: decToNum(invoice.lateFeeAmount),
    };
  }
  if (invoice.status === 'cancelled') {
    return {
      status: 'cancelled',
      paidAmount: invoice.paidAmount != null ? decToNum(invoice.paidAmount) : null,
      paidAt: invoice.paidAt,
      lateFeeAmount: decToNum(invoice.lateFeeAmount),
    };
  }

  const match = matchInvoicePaid(invoice, payments);
  if (match.paid) {
    return {
      status: 'paid',
      paidAmount: match.paidAmount,
      paidAt: match.paidAt,
      lateFeeAmount: 0,
    };
  }

  const late = computeLateFee(invoice, contract, asOf);
  if (late.overdue) {
    return {
      status: 'overdue',
      paidAmount: null,
      paidAt: null,
      lateFeeAmount: late.lateFeeAmount,
    };
  }

  return {
    status: 'open',
    paidAmount: null,
    paidAt: null,
    lateFeeAmount: 0,
  };
}
