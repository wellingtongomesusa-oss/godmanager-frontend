import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { documentToJson } from '../route';

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
    const row = await prisma.billingDocument.findFirst({
      where: {
        id: params.id,
        docType: 'INVOICE',
        contactEmail: { equals: email, mode: 'insensitive' },
      },
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
