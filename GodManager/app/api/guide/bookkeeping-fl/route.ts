import { NextResponse } from 'next/server';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { BOOKKEEPING_GUIDE_FL_MD } from '@/lib/bookkeepingGuideFL';

export const dynamic = 'force-dynamic';

/**
 * GET /api/guide/bookkeeping-fl
 * Manual oficial de Bookkeeping Imobiliário FL (markdown) para o popup do app.
 * Só usuários logados.
 */
export async function GET() {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ ok: true, markdown: BOOKKEEPING_GUIDE_FL_MD });
}
