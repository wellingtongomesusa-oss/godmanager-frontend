import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';
import { rentInvoiceToJson } from '@/lib/rentInvoices';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const scopeUser = toClientScopeUser(user);

  try {
    const { searchParams } = new URL(req.url);
    const contractId = searchParams.get('contractId')?.trim() || '';
    const propertyId = searchParams.get('propertyId')?.trim() || '';

    if (!contractId && !propertyId) {
      return NextResponse.json(
        { ok: false, error: 'contractId or propertyId is required' },
        { status: 400 },
      );
    }

    if (propertyId) {
      const property = await prisma.property.findFirst({
        where: { id: propertyId, ...getClientScopeWhere(scopeUser) },
        select: { id: true },
      });
      if (!property) {
        return NextResponse.json({ ok: false, error: 'Property not found' }, { status: 404 });
      }
    }

    if (contractId) {
      const contract = await prisma.leaseContract.findFirst({
        where: { id: contractId, ...getClientScopeWhere(scopeUser) },
        select: { id: true },
      });
      if (!contract) {
        return NextResponse.json({ ok: false, error: 'Contract not found' }, { status: 404 });
      }
    }

    const rows = await prisma.rentInvoice.findMany({
      where: {
        ...getClientScopeWhere(scopeUser),
        ...(contractId ? { contractId } : {}),
        ...(propertyId ? { propertyId } : {}),
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { monthRef: 'asc' },
    });

    return NextResponse.json({
      ok: true,
      invoices: rows.map((inv) => rentInvoiceToJson(inv, inv.items)),
    });
  } catch (e) {
    console.error('[GET /api/rent-invoices]', e);
    return NextResponse.json({ ok: false, error: 'Failed to list rent invoices' }, { status: 500 });
  }
}
