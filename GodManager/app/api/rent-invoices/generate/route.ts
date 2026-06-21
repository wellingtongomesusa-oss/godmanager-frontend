import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';
import { roundMoney } from '@/lib/loanBilling';
import {
  addYearMonth,
  buildMoveInItems,
  dueDateFirstOfMonthUtc,
  monthsRange,
  parseYearMonth,
  rentInvoiceCode,
  rentInvoiceToJson,
  resolveContractRentDeposit,
  sumItemAmounts,
  toDecimalAmount,
  utcCurrentYearMonth,
  yearMonthFromDate,
  type RentInvoiceWithItems,
} from '@/lib/rentInvoices';

export const dynamic = 'force-dynamic';

function parseOptionalMoney(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return roundMoney(n);
}

async function findOrCreateMoveInInvoice(
  tx: Prisma.TransactionClient,
  opts: {
    contractId: string;
    propertyId: string;
    clientId: string | null;
    propertyCode: string;
    moveIn: Date;
    prorateFirstMonth: boolean;
    monthlyRent: number;
    deposit: number;
  },
): Promise<RentInvoiceWithItems> {
  const existing = await tx.rentInvoice.findFirst({
    where: { contractId: opts.contractId, type: 'MOVE_IN' },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
  if (existing) return existing;

  const moveInYm = yearMonthFromDate(opts.moveIn);
  const itemInputs = buildMoveInItems(
    opts.monthlyRent,
    opts.deposit,
    opts.prorateFirstMonth,
    opts.moveIn,
  );
  const amount = sumItemAmounts(itemInputs);
  const code = `${rentInvoiceCode(opts.propertyCode, moveInYm)}-MOVEIN`;

  return tx.rentInvoice.create({
    data: {
      ...(opts.clientId ? { clientId: opts.clientId } : {}),
      contractId: opts.contractId,
      propertyId: opts.propertyId,
      code,
      type: 'MOVE_IN',
      monthRef: moveInYm,
      dueDate: opts.moveIn,
      amount: toDecimalAmount(amount),
      status: 'open',
      items: {
        create: itemInputs.map((it) => ({
          label: it.label,
          amount: toDecimalAmount(it.amount),
          sortOrder: it.sortOrder,
        })),
      },
    },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
}

async function findOrCreateRentInvoice(
  tx: Prisma.TransactionClient,
  opts: {
    contractId: string;
    propertyId: string;
    clientId: string | null;
    propertyCode: string;
    monthRef: string;
    monthlyRent: number;
  },
): Promise<RentInvoiceWithItems> {
  const existing = await tx.rentInvoice.findFirst({
    where: {
      contractId: opts.contractId,
      monthRef: opts.monthRef,
      type: 'RENT',
    },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
  if (existing) return existing;

  const code = rentInvoiceCode(opts.propertyCode, opts.monthRef);
  const label = `Rent ${opts.monthRef}`;

  return tx.rentInvoice.create({
    data: {
      ...(opts.clientId ? { clientId: opts.clientId } : {}),
      contractId: opts.contractId,
      propertyId: opts.propertyId,
      code,
      type: 'RENT',
      monthRef: opts.monthRef,
      dueDate: dueDateFirstOfMonthUtc(opts.monthRef),
      amount: toDecimalAmount(opts.monthlyRent),
      status: 'open',
      items: {
        create: [
          {
            label,
            amount: toDecimalAmount(opts.monthlyRent),
            sortOrder: 0,
          },
        ],
      },
    },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const scopeUser = toClientScopeUser(user);

  try {
    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
    }

    const contractId = String(body.contractId ?? '').trim();
    if (!contractId) {
      return NextResponse.json({ ok: false, error: 'contractId is required' }, { status: 400 });
    }

    const bodyMonthlyRent = parseOptionalMoney(body.monthlyRent);
    if (body.monthlyRent != null && body.monthlyRent !== '' && bodyMonthlyRent === undefined) {
      return NextResponse.json({ ok: false, error: 'Invalid monthlyRent' }, { status: 400 });
    }
    const bodyDeposit = parseOptionalMoney(body.deposit);
    if (body.deposit != null && body.deposit !== '' && bodyDeposit === undefined) {
      return NextResponse.json({ ok: false, error: 'Invalid deposit' }, { status: 400 });
    }

    let throughMonth = parseYearMonth(body.throughMonth);
    if (body.throughMonth != null && body.throughMonth !== '' && !throughMonth) {
      return NextResponse.json({ ok: false, error: 'Invalid throughMonth' }, { status: 400 });
    }
    if (!throughMonth) throughMonth = utcCurrentYearMonth();

    const contract = await prisma.leaseContract.findFirst({
      where: { id: contractId, ...getClientScopeWhere(scopeUser) },
    });
    if (!contract) {
      return NextResponse.json({ ok: false, error: 'Contract not found' }, { status: 404 });
    }

    const property = await prisma.property.findFirst({
      where: { id: contract.propertyId, ...getClientScopeWhere(scopeUser) },
      select: { id: true, code: true, rent: true, deposit: true },
    });
    if (!property) {
      return NextResponse.json({ ok: false, error: 'Property not found' }, { status: 404 });
    }

    const defaults = resolveContractRentDeposit(contract, property);
    const monthlyRent =
      bodyMonthlyRent !== undefined ? bodyMonthlyRent : defaults.monthlyRent;
    const deposit = bodyDeposit !== undefined ? bodyDeposit : defaults.deposit;

    const invoices = await prisma.$transaction(async (tx) => {
      await tx.leaseContract.update({
        where: { id: contract.id },
        data: {
          monthlyRent: toDecimalAmount(monthlyRent),
          deposit: toDecimalAmount(deposit),
        },
      });

      const clientId = contract.clientId ?? null;
      const propertyCode = property.code;
      const moveInYm = yearMonthFromDate(contract.moveIn);
      const firstRentYm = addYearMonth(moveInYm, 1);
      const rentMonths = monthsRange(firstRentYm, throughMonth);

      const collected: RentInvoiceWithItems[] = [];

      const moveInInv = await findOrCreateMoveInInvoice(tx, {
        contractId: contract.id,
        propertyId: contract.propertyId,
        clientId,
        propertyCode,
        moveIn: contract.moveIn,
        prorateFirstMonth: contract.prorateFirstMonth,
        monthlyRent,
        deposit,
      });
      collected.push(moveInInv);

      for (const monthRef of rentMonths) {
        const rentInv = await findOrCreateRentInvoice(tx, {
          contractId: contract.id,
          propertyId: contract.propertyId,
          clientId,
          propertyCode,
          monthRef,
          monthlyRent,
        });
        collected.push(rentInv);
      }

      return collected;
    });

    return NextResponse.json({
      ok: true,
      invoices: invoices.map((inv) => rentInvoiceToJson(inv, inv.items)),
    });
  } catch (e) {
    console.error('[POST /api/rent-invoices/generate]', e);
    return NextResponse.json({ ok: false, error: 'Failed to generate rent invoices' }, { status: 500 });
  }
}
