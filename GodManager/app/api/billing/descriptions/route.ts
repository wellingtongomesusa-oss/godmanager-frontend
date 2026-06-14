import { NextResponse } from 'next/server';
import type { BillingDescription } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getClientScopeForCreate, getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';

export const dynamic = 'force-dynamic';

function descriptionToJson(d: BillingDescription) {
  return {
    id: d.id,
    clientId: d.clientId,
    text: d.text,
    createdAt: d.createdAt.toISOString(),
  };
}

export async function GET() {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const scopeUser = toClientScopeUser(user);

  try {
    const rows = await prisma.billingDescription.findMany({
      where: { ...getClientScopeWhere(scopeUser) },
      orderBy: { text: 'asc' },
    });
    return NextResponse.json({ ok: true, descriptions: rows.map(descriptionToJson) });
  } catch (e) {
    console.error('[GET /api/billing/descriptions]', e);
    return NextResponse.json({ ok: false, error: 'Failed to list descriptions' }, { status: 500 });
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

    const text = String(body.text ?? '').trim();
    if (!text) {
      return NextResponse.json({ ok: false, error: 'text is required' }, { status: 400 });
    }

    const scopedClientId = getClientScopeForCreate(scopeUser);
    const bodyClientId =
      typeof body.clientId === 'string' ? String(body.clientId).trim() : null;
    const clientId = scopedClientId ?? (bodyClientId || null);

    const row = await prisma.billingDescription.create({
      data: {
        ...(clientId ? { clientId } : {}),
        text,
      },
    });
    return NextResponse.json({ ok: true, description: descriptionToJson(row) }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/billing/descriptions]', e);
    return NextResponse.json({ ok: false, error: 'Failed to create description' }, { status: 500 });
  }
}
