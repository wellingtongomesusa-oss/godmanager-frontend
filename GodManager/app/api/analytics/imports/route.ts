import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

function clientIdFromRequest(user: { clientId: string | null }, req: Request): string | null {
  if (user.clientId) return user.clientId;
  const fromHeader = req.headers.get('x-client-id')?.trim();
  return fromHeader || null;
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUserFromSession();
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    if (user.role !== UserRole.super_admin) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }
    const clientId = clientIdFromRequest(user, req);
    if (!clientId) return NextResponse.json({ ok: false, error: 'No clientId' }, { status: 400 });

    const imports = await prisma.gLImport.findMany({
      where: { clientId },
      orderBy: { uploadedAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      ok: true,
      imports: imports.map((i) => ({
        ...i,
        totalDebit: i.totalDebit?.toString() || null,
        totalCredit: i.totalCredit?.toString() || null,
      })),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
