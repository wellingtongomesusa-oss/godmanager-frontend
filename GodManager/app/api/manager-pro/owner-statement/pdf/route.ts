import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { toClientScopeUser } from '@/lib/clientScope';
import { buildStatementPdfBuffer } from '@/lib/ownerStatementPdf';
import { normalizeYearMonthForWrite } from '@/lib/pmMonthRef';

export const dynamic = 'force-dynamic';

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function isStmtAdmin(role: string): boolean {
  return role === 'admin' || role === 'super_admin';
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!isStmtAdmin(user.role)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const propertyId = (url.searchParams.get('propertyId') ?? '').trim();
  const periodRaw = (url.searchParams.get('period') ?? '').trim();
  const periodNorm = normalizeYearMonthForWrite(periodRaw);
  const langRaw = (url.searchParams.get('lang') ?? 'en').toLowerCase();
  const lang: 'pt' | 'en' = langRaw === 'en' ? 'en' : 'pt';

  if (!propertyId || !periodNorm || !PERIOD_RE.test(periodNorm)) {
    return NextResponse.json(
      { ok: false, error: 'Invalid propertyId or period' },
      { status: 400 }
    );
  }

  const scopeUser = toClientScopeUser(user);
  const result = await buildStatementPdfBuffer({
    scopeUser,
    propertyId,
    yearMonth: periodNorm,
    lang,
  });

  if (!result.ok) {
    const status =
      result.code === 'forbidden'
        ? 403
        : result.code === 'property_not_found'
          ? 404
          : result.code === 'no_statement'
            ? 404
            : 500;
    return NextResponse.json(
      { ok: false, error: result.error, code: result.code },
      { status }
    );
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
