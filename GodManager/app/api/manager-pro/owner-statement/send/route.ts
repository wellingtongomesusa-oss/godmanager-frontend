import { NextResponse } from 'next/server';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { toClientScopeUser } from '@/lib/clientScope';
import { sendOwnerStatementForProperty } from '@/lib/ownerStatementEmail';
import { normalizeYearMonthForWrite } from '@/lib/pmMonthRef';

export const dynamic = 'force-dynamic';

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function isStmtAdmin(role: string): boolean {
  return role === 'admin' || role === 'super_admin';
}

export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!isStmtAdmin(user.role)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const propertyId = typeof body.propertyId === 'string' ? body.propertyId.trim() : '';
  const yearMonthRaw = typeof body.yearMonth === 'string' ? body.yearMonth.trim() : '';
  const yearMonthNorm = normalizeYearMonthForWrite(yearMonthRaw);

  if (!propertyId || !yearMonthNorm || !YEAR_MONTH.test(yearMonthNorm)) {
    return NextResponse.json({ ok: false, error: 'Invalid propertyId or yearMonth' }, { status: 400 });
  }

  const scopeUser = toClientScopeUser(user);
  const result = await sendOwnerStatementForProperty({
    scopeUser,
    actorId: user.id,
    actorEmail: user.email ?? null,
    propertyId,
    yearMonthNorm,
  });

  if (!result.ok) {
    const status =
      result.code === 'forbidden'
        ? 403
        : result.code === 'property_not_found'
          ? 404
          : result.code === 'no_statement' || result.code === 'no_owner_email'
            ? 400
            : 500;
    return NextResponse.json(
      { ok: false, error: result.error, code: result.code },
      { status }
    );
  }

  return NextResponse.json({
    ok: true,
    sentTo: result.sentTo,
    sentAt: result.sentAt,
  });
}
