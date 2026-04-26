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
  source: string | null;
  reviewedAt: Date | null;
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
    source: v.source ?? '',
    reviewed_at: v.reviewedAt ? v.reviewedAt.toISOString() : '',
    metadata: v.metadata ?? {},
    created_at: v.createdAt.toISOString(),
    updated_at: v.updatedAt.toISOString(),
  };
}

export async function GET() {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const rows = await prisma.pmVendor.findMany({ orderBy: { companyName: 'asc' } });
    return NextResponse.json({ ok: true, vendors: rows.map(toJson) });
  } catch (e) {
    console.error('[GET /api/pm/vendors]', e);
    return NextResponse.json({ ok: false, error: 'Failed to list vendors' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
    }

    const companyName = String(body.company_name || body.companyName || '').trim();
    const email = String(body.email || '').trim();
    const phone = String(body.phone || '').trim();
    const addressStreet = String(body.address_street || body.addressStreet || '').trim();
    if (!companyName || !email || !phone || !addressStreet) {
      return NextResponse.json({ ok: false, error: 'company_name, email, phone, address_street required' }, { status: 400 });
    }

    const defaultPackage = (['PACOTE_1', 'PACOTE_2', 'PACOTE_3', 'PACOTE_4'] as const).includes(
      body.default_package,
    )
      ? body.default_package
      : 'PACOTE_1';

    const row = await prisma.pmVendor.create({
      data: {
        companyName,
        contactName: String(body.contact_name || body.contactName || '').trim() || null,
        email,
        phone,
        addressStreet,
        addressCity: String(body.address_city || body.addressCity || '').trim() || null,
        addressState: String(body.address_state || body.addressState || '').trim() || null,
        addressZip: String(body.address_zip || body.addressZip || '').trim() || null,
        trade: String(body.trade || '').trim() || null,
        serviceType: String(body.service_type || body.serviceType || '').trim() || null,
        defaultPackage,
        bankName: String(body.bank_name || body.bankName || '').trim() || null,
        routingNumber: String(body.routing_number || body.routingNumber || '').trim() || null,
        accountNumber: String(body.account_number || body.accountNumber || '').trim() || null,
        accountType: String(body.account_type || body.accountType || '').trim() || null,
        paymentType: String(body.payment_type || body.paymentType || '').trim() || null,
        commissionMp: !!body.commission_mp || !!body.commissionMp,
        send1099: body.send_1099 !== false && body.send1099 !== 'false',
        status: String(body.status || 'Active').trim() || 'Active',
        notes: String(body.notes || '').trim() || null,
        source: String(body.source || 'manual').trim() || 'manual',
        reviewedAt: body.reviewed_at ? new Date(String(body.reviewed_at)) : (body.reviewedAt ? new Date(String(body.reviewedAt)) : null),
        metadata: (body.metadata && typeof body.metadata === 'object' ? body.metadata : {}) as object,
      },
    });
    return NextResponse.json({ ok: true, vendor: toJson(row) });
  } catch (e) {
    console.error('[POST /api/pm/vendors]', e);
    return NextResponse.json({ ok: false, error: 'Failed to create vendor' }, { status: 500 });
  }
}
