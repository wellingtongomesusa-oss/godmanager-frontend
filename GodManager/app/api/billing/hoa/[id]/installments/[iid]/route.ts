import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';
import { decToNum, roundMoney } from '@/lib/loanBilling';
import {
  cancelHoaInstallmentPmExpense,
  ensureHoaInstallmentPmExpense,
  hoaInstallmentToJson,
  parseOptionalDate,
  syncHoaChargeStatusFromInstallments,
  syncOwnerStatementForHoaInstallment,
} from '@/lib/hoaBilling';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; iid: string } },
) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const scopeUser = toClientScopeUser(user);

  try {
    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
    }

    if (body.paid === undefined) {
      return NextResponse.json({ ok: false, error: 'paid is required' }, { status: 400 });
    }

    const paid = body.paid === true || body.paid === 'true' || body.paid === 1 || body.paid === '1';

    const existing = await prisma.hoaInstallment.findFirst({
      where: {
        id: params.iid,
        hoaCharge: {
          id: params.id,
          ...getClientScopeWhere(scopeUser),
        },
      },
      include: { hoaCharge: true },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    if (existing.hoaCharge.status === 'cancelled') {
      return NextResponse.json(
        { ok: false, error: 'HOA charge is cancelled' },
        { status: 409 },
      );
    }

    const propertyId = existing.hoaCharge.propertyId;
    if (paid && !propertyId) {
      return NextResponse.json(
        { ok: false, error: 'HOA charge has no property' },
        { status: 400 },
      );
    }

    const data: Prisma.HoaInstallmentUpdateInput = { paid };

    if (paid) {
      const paidAtParsed = parseOptionalDate(body.paidAt);
      if (paidAtParsed === undefined && body.paidAt != null && body.paidAt !== '') {
        return NextResponse.json({ ok: false, error: 'Invalid paidAt' }, { status: 400 });
      }
      data.paidAt = paidAtParsed ?? new Date();

      if (body.paidAmount != null && body.paidAmount !== '') {
        const pa = Number(body.paidAmount);
        if (!Number.isFinite(pa) || pa < 0) {
          return NextResponse.json({ ok: false, error: 'Invalid paidAmount' }, { status: 400 });
        }
        data.paidAmount = roundMoney(pa);
      } else {
        data.paidAmount = decToNum(existing.amount);
      }
    } else {
      data.paidAt = null;
      data.paidAmount = null;
    }

    if (body.notes !== undefined) {
      data.notes = body.notes != null ? String(body.notes).trim() || null : null;
    }

    const result = await prisma.$transaction(async (tx) => {
      let pmExpenseId = existing.pmExpenseId;

      if (paid) {
        pmExpenseId = await ensureHoaInstallmentPmExpense(tx, {
          installment: existing,
          charge: existing.hoaCharge,
        });
        data.pmExpenseId = pmExpenseId;
      } else {
        await cancelHoaInstallmentPmExpense(tx, existing.pmExpenseId);
      }

      const installment = await tx.hoaInstallment.update({
        where: { id: existing.id },
        data,
      });
      const chargeStatus = await syncHoaChargeStatusFromInstallments(tx, existing.hoaChargeId);
      return { installment, chargeStatus };
    });

    if (propertyId) {
      await syncOwnerStatementForHoaInstallment({
        propertyId,
        dueDate: existing.dueDate,
        clientId: existing.clientId ?? existing.hoaCharge.clientId,
        scopeClientId: scopeUser.clientId,
        actorId: user.id,
      });
    }

    return NextResponse.json({
      ok: true,
      installment: hoaInstallmentToJson(result.installment),
      chargeStatus: result.chargeStatus,
    });
  } catch (e) {
    console.error('[PATCH /api/billing/hoa/:id/installments/:iid]', e);
    return NextResponse.json({ ok: false, error: 'Failed to update installment' }, { status: 500 });
  }
}
