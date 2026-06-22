import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { toClientScopeUser } from '@/lib/clientScope';
import { buildBillPdfBuffer } from '@/lib/billPdf';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const langRaw = (req.nextUrl.searchParams.get('lang') ?? 'pt').toLowerCase();
  const lang: 'pt' | 'en' = langRaw === 'en' ? 'en' : 'pt';

  const scopeUser = toClientScopeUser(user);
  const result = await buildBillPdfBuffer({
    scopeUser,
    documentId: params.id,
    lang,
  });

  if (!result.ok) {
    const status =
      result.code === 'not_found' || result.code === 'not_bill' ? 404 : 500;
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
