import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import {
  getClientScopeForCreate,
  getClientScopeWhere,
  toClientScopeUser,
} from '@/lib/clientScope';
import { roundMoney } from '@/lib/loanBilling';
import {
  buildHoaInstallments,
  fetchPropertySnapshots,
  hoaChargeToJson,
  nextHoaCode,
  parseOptionalDate,
} from '@/lib/hoaBilling';

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
    const includeInstallments = searchParams.get('includeInstallments') !== '0';

    const rows = await prisma.hoaCharge.findMany({
      where: {
        ...getClientScopeWhere(scopeUser),
        ...(status ? { status } : {}),
        ...(propertyId ? { propertyId } : {}),
        ...(q
          ? {
              OR: [
                { hoaName: { contains: q, mode: 'insensitive' } },
                { debtorName: { contains: q, mode: 'insensitive' } },
                { code: { contains: q, mode: 'insensitive' } },
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
      charges: rows.map((charge) =>
        hoaChargeToJson(charge, {
          property: charge.propertyId ? propMap.get(charge.propertyId) ?? null : null,
          includeInstallments,
        }),
      ),
    });
  } catch (e) {
    console.error('[GET /api/billing/hoa]', e);
    return NextResponse.json({ ok: false, error: 'Failed to list HOA charges' }, { status: 500 });
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

    const monthlyRaw = body.monthlyAmount;
    const monthlyAmount = Number(monthlyRaw);
    if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0) {
      return NextResponse.json(
        { ok: false, error: 'monthlyAmount must be greater than zero' },
        { status: 400 },
      );
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
      return NextResponse.json(
        { ok: false, error: 'startDate is required and must be valid' },
        { status: 400 },
      );
    }

    const scopedClientId = getClientScopeForCreate(scopeUser);
    const bodyClientId =
      typeof body.clientId === 'string' ? String(body.clientId).trim() : null;
    const clientId = scopedClientId ?? (bodyClientId || null);

    const installmentRows = buildHoaInstallments({
      monthlyAmount: roundMoney(monthlyAmount),
      installmentsCount,
      startDate: startDateParsed,
    });

    const row = await prisma.$transaction(async (tx) => {
      const code = await nextHoaCode(tx, clientId);
      const charge = await tx.hoaCharge.create({
        data: {
          code,
          ...(clientId ? { clientId } : {}),
          propertyId:
            body.propertyId != null ? String(body.propertyId).trim() || null : null,
          hoaName: body.hoaName != null ? String(body.hoaName).trim() || null : null,
          debtorName:
            body.debtorName != null ? String(body.debtorName).trim() || null : null,
          monthlyAmount: roundMoney(monthlyAmount),
          installmentsCount,
          startDate: startDateParsed,
          notes: body.notes != null ? String(body.notes).trim() || null : null,
          status: 'active',
          createdById: user.id,
          installments: {
            create: installmentRows.map((rowItem) => ({
              ...(clientId ? { clientId } : {}),
              seq: rowItem.seq,
              dueDate: rowItem.dueDate,
              amount: rowItem.amount,
              paid: false,
            })),
          },
        },
        include: { installments: true },
      });
      return charge;
    });

    const propMap = await fetchPropertySnapshots(
      scopeUser,
      row.propertyId ? [row.propertyId] : [],
    );

    return NextResponse.json(
      {
        ok: true,
        charge: hoaChargeToJson(row, {
          property: row.propertyId ? propMap.get(row.propertyId) ?? null : null,
        }),
      },
      { status: 201 },
    );
  } catch (e) {
    console.error('[POST /api/billing/hoa]', e);
    return NextResponse.json({ ok: false, error: 'Failed to create HOA charge' }, { status: 500 });
  }
}
