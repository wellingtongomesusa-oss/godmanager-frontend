import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { toClientScopeUser } from '@/lib/clientScope';
import { documentToJson } from '@/lib/billingInboxSerialize';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const email = (user.email || '').trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ ok: true, documents: [] });
  }

  try {
    const scope = toClientScopeUser(user);
    const where: Prisma.BillingDocumentWhereInput = {
      docType: 'INVOICE',
      contactEmail: { equals: email, mode: 'insensitive' },
    };
    // Isolamento por tenant: esconde faturas de outro cliente. Registros legados sem
    // clientId permanecem visiveis para nao ocultar faturas ja existentes do cliente.
    if (scope.role !== 'super_admin') {
      where.OR = [{ clientId: scope.clientId ?? '__no_access__' }, { clientId: null }];
    }
    const rows = await prisma.billingDocument.findMany({
      where,
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { issueDate: 'desc' },
    });
    return NextResponse.json({ ok: true, documents: rows.map(documentToJson) });
  } catch (e) {
    console.error('[GET /api/billing/inbox]', e);
    return NextResponse.json({ ok: false, error: 'Failed to list inbox' }, { status: 500 });
  }
}
