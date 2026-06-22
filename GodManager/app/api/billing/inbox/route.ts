import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { documentToJson } from '@/lib/billingInboxSerialize';

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
    const rows = await prisma.billingDocument.findMany({
      where: {
        docType: 'INVOICE',
        contactEmail: { equals: email, mode: 'insensitive' },
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { issueDate: 'desc' },
    });
    return NextResponse.json({ ok: true, documents: rows.map(documentToJson) });
  } catch (e) {
    console.error('[GET /api/billing/inbox]', e);
    return NextResponse.json({ ok: false, error: 'Failed to list inbox' }, { status: 500 });
  }
}
