import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { toClientScopeUser } from '@/lib/clientScope';
import { documentToJson } from '@/lib/billingInboxSerialize';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const email = (user.email || '').trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  }

  try {
    const scope = toClientScopeUser(user);
    const where: Prisma.BillingDocumentWhereInput = {
      id: params.id,
      docType: 'INVOICE',
      contactEmail: { equals: email, mode: 'insensitive' },
    };
    // Isolamento por tenant (esconde de outro cliente; mantem legado sem clientId visivel)
    if (scope.role !== 'super_admin') {
      where.OR = [{ clientId: scope.clientId ?? '__no_access__' }, { clientId: null }];
    }
    const row = await prisma.billingDocument.findFirst({
      where,
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!row) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, document: documentToJson(row) });
  } catch (e) {
    console.error('[GET /api/billing/inbox/:id]', e);
    return NextResponse.json({ ok: false, error: 'Failed to get document' }, { status: 500 });
  }
}
