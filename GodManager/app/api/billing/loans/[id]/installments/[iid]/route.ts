import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';
import {
  decToNum,
  installmentToJson,
  parseOptionalDate,
  roundMoney,
  syncLoanStatusFromInstallments,
} from '@/lib/loanBilling';

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

    const existing = await prisma.loanInstallment.findFirst({
      where: {
        id: params.iid,
        loan: {
          id: params.id,
          ...getClientScopeWhere(scopeUser),
        },
      },
      include: { loan: true },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    const data: Prisma.LoanInstallmentUpdateInput = { paid };

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
      const installment = await tx.loanInstallment.update({
        where: { id: existing.id },
        data,
      });
      const loanStatus = await syncLoanStatusFromInstallments(tx, existing.loanId);
      return { installment, loanStatus };
    });

    return NextResponse.json({
      ok: true,
      installment: installmentToJson(result.installment),
      loanStatus: result.loanStatus,
    });
  } catch (e) {
    console.error('[PATCH /api/billing/loans/:id/installments/:iid]', e);
    return NextResponse.json({ ok: false, error: 'Failed to update installment' }, { status: 500 });
  }
}
