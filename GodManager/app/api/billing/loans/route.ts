import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getClientScopeForCreate, getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';
import {
  addMonthsToDate,
  buildInstallmentAmounts,
  fetchPropertySnapshots,
  loanToJson,
  parseOptionalDate,
  roundMoney,
} from '@/lib/loanBilling';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const scopeUser = toClientScopeUser(user);

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status')?.trim() || '';
    const propertyId = searchParams.get('propertyId')?.trim() || '';
    const q = searchParams.get('q')?.trim() || '';

    const rows = await prisma.loan.findMany({
      where: {
        ...getClientScopeWhere(scopeUser),
        ...(status ? { status } : {}),
        ...(propertyId ? { propertyId } : {}),
        ...(q
          ? {
              OR: [
                { debtorName: { contains: q, mode: 'insensitive' } },
                { guarantorName: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { installments: true },
      orderBy: { createdAt: 'desc' },
    });

    const propMap = await fetchPropertySnapshots(
      scopeUser,
      rows.map((r) => r.propertyId).filter((id): id is string => Boolean(id)),
    );

    return NextResponse.json({
      ok: true,
      loans: rows.map((loan) =>
        loanToJson(loan, {
          property: loan.propertyId ? propMap.get(loan.propertyId) ?? null : null,
        }),
      ),
    });
  } catch (e) {
    console.error('[GET /api/billing/loans]', e);
    return NextResponse.json({ ok: false, error: 'Failed to list loans' }, { status: 500 });
  }
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

    const debtorName = String(body.debtorName ?? '').trim();
    if (!debtorName) {
      return NextResponse.json({ ok: false, error: 'debtorName is required' }, { status: 400 });
    }

    const principalRaw = body.principal;
    const principal = Number(principalRaw);
    if (!Number.isFinite(principal) || principal <= 0) {
      return NextResponse.json({ ok: false, error: 'principal must be greater than zero' }, { status: 400 });
    }

    const countRaw = body.installmentsCount;
    const installmentsCount = Number(countRaw);
    if (!Number.isInteger(installmentsCount) || installmentsCount < 1) {
      return NextResponse.json(
        { ok: false, error: 'installmentsCount must be an integer >= 1' },
        { status: 400 },
      );
    }

    const startDateParsed = parseOptionalDate(body.startDate);
    if (!startDateParsed) {
      return NextResponse.json({ ok: false, error: 'startDate is required and must be valid' }, { status: 400 });
    }

    let interestRate: number | null = null;
    if (body.interestRate != null && body.interestRate !== '') {
      const ir = Number(body.interestRate);
      if (!Number.isFinite(ir) || ir < 0) {
        return NextResponse.json({ ok: false, error: 'Invalid interestRate' }, { status: 400 });
      }
      interestRate = ir;
    }

    const scopedClientId = getClientScopeForCreate(scopeUser);
    const bodyClientId =
      typeof body.clientId === 'string' ? String(body.clientId).trim() : null;
    const clientId = scopedClientId ?? (bodyClientId || null);

    const amounts = buildInstallmentAmounts(roundMoney(principal), installmentsCount);

    const row = await prisma.$transaction(async (tx) => {
      const loan = await tx.loan.create({
        data: {
          ...(clientId ? { clientId } : {}),
          propertyId:
            body.propertyId != null ? String(body.propertyId).trim() || null : null,
          debtorName,
          guarantorName:
            body.guarantorName != null ? String(body.guarantorName).trim() || null : null,
          principal: roundMoney(principal),
          ...(interestRate != null ? { interestRate } : {}),
          startDate: startDateParsed,
          installmentsCount,
          notes: body.notes != null ? String(body.notes).trim() || null : null,
          status: body.status != null ? String(body.status).trim() || 'active' : 'active',
          createdById: user.id,
          installments: {
            create: amounts.map((amount, idx) => {
              const seq = idx + 1;
              return {
                ...(clientId ? { clientId } : {}),
                seq,
                dueDate: addMonthsToDate(startDateParsed, seq - 1),
                amount,
                paid: false,
              };
            }),
          },
        },
        include: { installments: true },
      });
      return loan;
    });

    const propMap = await fetchPropertySnapshots(
      scopeUser,
      row.propertyId ? [row.propertyId] : [],
    );

    return NextResponse.json(
      {
        ok: true,
        loan: loanToJson(row, {
          property: row.propertyId ? propMap.get(row.propertyId) ?? null : null,
        }),
      },
      { status: 201 },
    );
  } catch (e) {
    console.error('[POST /api/billing/loans]', e);
    return NextResponse.json({ ok: false, error: 'Failed to create loan' }, { status: 500 });
  }
}
