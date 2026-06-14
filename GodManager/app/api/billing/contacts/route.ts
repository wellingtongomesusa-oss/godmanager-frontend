import { NextResponse } from 'next/server';
import type { BillingContact } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getClientScopeForCreate, getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';

export const dynamic = 'force-dynamic';

function contactToJson(c: BillingContact) {
  return {
    id: c.id,
    clientId: c.clientId,
    name: c.name,
    email: c.email,
    phone: c.phone,
    kind: c.kind,
    isVendorRef: c.isVendorRef,
    vendorId: c.vendorId,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const scopeUser = toClientScopeUser(user);

  try {
    const { searchParams } = new URL(req.url);
    const kind = searchParams.get('kind');
    const kindFilter = kind ? String(kind).trim() : '';

    const rows = await prisma.billingContact.findMany({
      where: {
        ...getClientScopeWhere(scopeUser),
        ...(kindFilter ? { kind: kindFilter } : {}),
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ ok: true, contacts: rows.map(contactToJson) });
  } catch (e) {
    console.error('[GET /api/billing/contacts]', e);
    return NextResponse.json({ ok: false, error: 'Failed to list contacts' }, { status: 500 });
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

    const name = String(body.name ?? '').trim();
    if (!name) {
      return NextResponse.json({ ok: false, error: 'name is required' }, { status: 400 });
    }

    const scopedClientId = getClientScopeForCreate(scopeUser);
    const bodyClientId =
      typeof body.clientId === 'string' ? String(body.clientId).trim() : null;
    const clientId = scopedClientId ?? (bodyClientId || null);

    const row = await prisma.billingContact.create({
      data: {
        ...(clientId ? { clientId } : {}),
        name,
        email: body.email != null ? String(body.email).trim() || null : null,
        phone: body.phone != null ? String(body.phone).trim() || null : null,
        kind: body.kind != null ? String(body.kind).trim() || 'both' : 'both',
        isVendorRef: !!body.isVendorRef,
        vendorId: body.vendorId != null ? String(body.vendorId).trim() || null : null,
      },
    });
    return NextResponse.json({ ok: true, contact: contactToJson(row) }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/billing/contacts]', e);
    return NextResponse.json({ ok: false, error: 'Failed to create contact' }, { status: 500 });
  }
}
