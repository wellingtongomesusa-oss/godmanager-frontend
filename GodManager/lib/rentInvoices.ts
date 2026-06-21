import type { LeaseContract, Property, RentInvoice, RentInvoiceItem } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { decToNum, moneyStr, roundMoney } from '@/lib/loanBilling';

export type RentInvoiceItemInput = { label: string; amount: number; sortOrder: number };

export type RentInvoiceWithItems = RentInvoice & { items: RentInvoiceItem[] };

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
