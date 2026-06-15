import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { canAccessClientId, getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';

export const dynamic = 'force-dynamic';

const MGM_FEE_DESC_RE =
  /MGM|Management Fee|Management Fees|Mgmt Fee|Taxa de gest[aã]o/i;

function decToNum(v: Prisma.Decimal | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function isMgmFeeLine(lineType: string, description: string): boolean {
  if (String(lineType).toLowerCase() !== 'expense') return false;
  const desc = String(description || '').trim();
  if (!desc) return false;
  return MGM_FEE_DESC_RE.test(desc);
}

export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const scopeUser = toClientScopeUser(user);
    const url = new URL(req.url);
    const propertyId = (url.searchParams.get('propertyId') || '').trim();

    if (!propertyId) {
      return NextResponse.json({ ok: false, error: 'propertyId required' }, { status: 400 });
    }

    const property = await prisma.property.findFirst({
      where: { id: propertyId, ...getClientScopeWhere(scopeUser) },
      select: { id: true, clientId: true },
    });
    if (!property) {
      return NextResponse.json({ ok: false, error: 'Property not found' }, { status: 404 });
    }
    if (!canAccessClientId(scopeUser, property.clientId)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const lineItems = await prisma.statementLineItem.findMany({
      where: { ownerMonthPayout: { propertyId: property.id } },
      select: { lineType: true, amount: true, description: true },
    });

    let creditCount = 0;
    let creditTotal = 0;
    let debitCount = 0;
    let debitTotal = 0;
    let mgmTotal = 0;

    for (const li of lineItems) {
      const amt = decToNum(li.amount);
      const lt = String(li.lineType || '').toLowerCase();
      if (lt === 'income') {
        creditCount += 1;
        creditTotal += amt;
      } else if (lt === 'expense') {
        debitCount += 1;
        debitTotal += amt;
        if (isMgmFeeLine(li.lineType, li.description)) {
          mgmTotal += amt;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      propertyId: property.id,
      creditCount,
      creditTotal: roundMoney(creditTotal),
      debitCount,
      debitTotal: roundMoney(debitTotal),
      mgmTotal: roundMoney(mgmTotal),
    });
  } catch (e) {
    console.error('[GET /api/manager-pro/owner-statement/accumulated]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
