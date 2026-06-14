import { NextResponse } from 'next/server';
import type { BillingContact } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';

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

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const scopeUser = toClientScopeUser(user);

  try {
    const id = params.id;
    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
    }

    const existing = await prisma.billingContact.findFirst({
      where: { id, ...getClientScopeWhere(scopeUser) },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    const data: {
      name?: string;
      email?: string | null;
      phone?: string | null;
      kind?: string;
      isVendorRef?: boolean;
      vendorId?: string | null;
    } = {};

    if (body.name != null) {
      const name = String(body.name).trim();
      if (!name) {
        return NextResponse.json({ ok: false, error: 'name cannot be empty' }, { status: 400 });
      }
      data.name = name;
    }
    if (body.email != null) data.email = String(body.email).trim() || null;
    if (body.phone != null) data.phone = String(body.phone).trim() || null;
    if (body.kind != null) data.kind = String(body.kind).trim() || 'both';
    if (body.isVendorRef != null) data.isVendorRef = !!body.isVendorRef;
    if (body.vendorId != null) data.vendorId = String(body.vendorId).trim() || null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: 'No valid fields to update' }, { status: 400 });
    }

    const row = await prisma.billingContact.update({ where: { id }, data });
    return NextResponse.json({ ok: true, contact: contactToJson(row) });
  } catch (e) {
    console.error('[PATCH /api/billing/contacts/:id]', e);
    return NextResponse.json({ ok: false, error: 'Failed to update contact' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const scopeUser = toClientScopeUser(user);

  try {
    const existing = await prisma.billingContact.findFirst({
      where: { id: params.id, ...getClientScopeWhere(scopeUser) },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    await prisma.billingContact.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[DELETE /api/billing/contacts/:id]', e);
    return NextResponse.json({ ok: false, error: 'Failed to delete contact' }, { status: 500 });
  }
}
