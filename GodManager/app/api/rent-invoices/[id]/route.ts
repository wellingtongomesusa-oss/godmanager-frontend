import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';
import { decToNum, roundMoney } from '@/lib/loanBilling';
import { rentInvoiceToJson, toDecimalAmount } from '@/lib/rentInvoices';

export const dynamic = 'force-dynamic';

function parseOptionalMoney(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return roundMoney(n);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
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

    const existing = await prisma.rentInvoice.findFirst({
      where: { id: params.id, ...getClientScopeWhere(scopeUser) },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    if (existing.status === 'cancelled') {
      return NextResponse.json({ ok: false, error: 'cancelled_invoice' }, { status: 409 });
    }

    const paid = Boolean(body.paid);
    let data: {
      status: string;
      paidAt: Date | null;
      paidAmount: ReturnType<typeof toDecimalAmount> | null;
      notes?: string | null;
    };

    if (paid) {
      const bodyPaidAmount = parseOptionalMoney(body.paidAmount);
      if (body.paidAmount != null && body.paidAmount !== '' && bodyPaidAmount === undefined) {
        return NextResponse.json({ ok: false, error: 'Invalid paidAmount' }, { status: 400 });
      }
      const amount = decToNum(existing.amount);
      const paidAmount = bodyPaidAmount !== undefined ? bodyPaidAmount : amount;
      data = {
        status: 'paid',
        paidAt: new Date(),
        paidAmount: toDecimalAmount(paidAmount),
      };
    } else {
      data = {
        status: 'open',
        paidAt: null,
        paidAmount: null,
      };
    }

    if (body.notes !== undefined) {
      data.notes = body.notes != null ? String(body.notes).trim() || null : null;
    }

    const row = await prisma.rentInvoice.update({
      where: { id: existing.id },
      data,
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    return NextResponse.json({
      ok: true,
      invoice: rentInvoiceToJson(row, row.items),
    });
  } catch (e) {
    console.error('[PATCH /api/rent-invoices/:id]', e);
    return NextResponse.json({ ok: false, error: 'Failed to update rent invoice' }, { status: 500 });
  }
}
