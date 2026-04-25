import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import type { PmPackage } from '@prisma/client';
import { PM_PACKAGE_MARKUP_PCT } from '@/lib/pmPackages';

export const dynamic = 'force-dynamic';

function toJson(v: {
  id: string;
  companyName: string;
  contactName: string | null;
  email: string;
  phone: string;
  addressStreet: string;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  trade: string | null;
  serviceType: string | null;
  defaultPackage: PmPackage;
  bankName: string | null;
  routingNumber: string | null;
  accountNumber: string | null;
  accountType: string | null;
  paymentType: string | null;
  commissionMp: boolean;
  send1099: boolean;
  status: string;
  notes: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: v.id,
    company_name: v.companyName,
    contact_name: v.contactName ?? '',
    email: v.email,
    phone: v.phone,
    address_street: v.addressStreet,
    address_city: v.addressCity ?? '',
    address_state: v.addressState ?? '',
    address_zip: v.addressZip ?? '',
    trade: v.trade ?? '',
    service_type: v.serviceType ?? '',
    default_package: v.defaultPackage,
    markup_pct: PM_PACKAGE_MARKUP_PCT[v.defaultPackage],
    bank_name: v.bankName ?? '',
    routing_number: v.routingNumber ?? '',
    account_number: v.accountNumber ?? '',
    account_type: v.accountType ?? '',
    payment_type: v.paymentType ?? '',
    commission_mp: v.commissionMp,
    send_1099: v.send1099,
    status: v.status,
    notes: v.notes ?? '',
    metadata: v.metadata ?? {},
    created_at: v.createdAt.toISOString(),
    updated_at: v.updatedAt.toISOString(),
  };
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const id = params.id;
    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (body.company_name != null) data.companyName = String(body.company_name).trim();
    if (body.contact_name != null) data.contactName = String(body.contact_name).trim() || null;
    if (body.email != null) data.email = String(body.email).trim();
    if (body.phone != null) data.phone = String(body.phone).trim();
    if (body.address_street != null) data.addressStreet = String(body.address_street).trim();
    if (body.address_city != null) data.addressCity = String(body.address_city).trim() || null;
    if (body.address_state != null) data.addressState = String(body.address_state).trim() || null;
    if (body.address_zip != null) data.addressZip = String(body.address_zip).trim() || null;
    if (body.trade != null) data.trade = String(body.trade).trim() || null;
    if (body.service_type != null) data.serviceType = String(body.service_type).trim() || null;
    if (body.default_package != null && ['PACOTE_1', 'PACOTE_2', 'PACOTE_3'].includes(String(body.default_package))) {
      data.defaultPackage = body.default_package;
    }
    if (body.bank_name != null) data.bankName = String(body.bank_name).trim() || null;
    if (body.routing_number != null) data.routingNumber = String(body.routing_number).trim() || null;
    if (body.account_number != null) data.accountNumber = String(body.account_number).trim() || null;
    if (body.account_type != null) data.accountType = String(body.account_type).trim() || null;
    if (body.payment_type != null) data.paymentType = String(body.payment_type).trim() || null;
    if (body.commission_mp != null) data.commissionMp = !!body.commission_mp;
    if (body.send_1099 != null) data.send1099 = body.send_1099 !== false && body.send_1099 !== 'false';
    if (body.status != null) data.status = String(body.status).trim();
    if (body.notes != null) data.notes = String(body.notes).trim() || null;
    if (body.metadata != null && typeof body.metadata === 'object') data.metadata = body.metadata;

    const row = await prisma.pmVendor.update({ where: { id }, data: data as object });
    return NextResponse.json({ ok: true, vendor: toJson(row) });
  } catch (e) {
    console.error('[PATCH /api/pm/vendors/:id]', e);
    return NextResponse.json({ ok: false, error: 'Failed to update vendor' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    await prisma.pmVendor.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[DELETE /api/pm/vendors/:id]', e);
    return NextResponse.json({ ok: false, error: 'Failed to delete vendor' }, { status: 500 });
  }
}
