import { NextResponse } from 'next/server';
import type { BillingCategory } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getClientScopeForCreate, getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';

export const dynamic = 'force-dynamic';

function categoryToJson(c: BillingCategory) {
  return {
    id: c.id,
    clientId: c.clientId,
    name: c.name,
    createdAt: c.createdAt.toISOString(),
  };
}

export async function GET() {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const scopeUser = toClientScopeUser(user);

  try {
    const rows = await prisma.billingCategory.findMany({
      where: { ...getClientScopeWhere(scopeUser) },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ ok: true, categories: rows.map(categoryToJson) });
  } catch (e) {
    console.error('[GET /api/billing/categories]', e);
    return NextResponse.json({ ok: false, error: 'Failed to list categories' }, { status: 500 });
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

    const row = await prisma.billingCategory.create({
      data: {
        ...(clientId ? { clientId } : {}),
        name,
      },
    });
    return NextResponse.json({ ok: true, category: categoryToJson(row) }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/billing/categories]', e);
    return NextResponse.json({ ok: false, error: 'Failed to create category' }, { status: 500 });
  }
}
