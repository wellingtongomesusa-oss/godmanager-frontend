import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { appSheetVisitsKey, type AppSheetVisitsPayload } from '@/lib/appsheetVisits';

export const dynamic = 'force-dynamic';

/**
 * GET /api/appsheet/visits?month=YYYY-MM  — visitas de campo do AppSheet (read-only, informativo).
 * Lê AppSetting `appsheet:visits:<clientId>`. Escopo por cliente. Tolerante: se o usuário não tem
 * escopo (ex.: papel sem acesso financeiro), devolve lista vazia (200) para não quebrar a tela de
 * Expenses. Ver [[lib/appsheetVisits]].
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  try {
    const url = new URL(req.url);
    const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
    if (!scope.ok) return NextResponse.json({ ok: true, visits: [], count: 0, source: null, updatedAt: null });

    const row = await prisma.appSetting.findUnique({ where: { key: appSheetVisitsKey(scope.clientId) } });
    const payload = (row?.value as unknown as AppSheetVisitsPayload | undefined) || null;
    let visits = payload?.visits || [];

    const month = /^\d{4}-\d{2}$/.test(url.searchParams.get('month') || '') ? (url.searchParams.get('month') as string) : '';
    if (month) visits = visits.filter((v) => v.month === month);

    return NextResponse.json({
      ok: true,
      visits,
      count: visits.length,
      source: payload?.source || null,
      updatedAt: payload?.updatedAt || null,
    });
  } catch (e) {
    console.error('[GET /api/appsheet/visits]', e instanceof Error ? e.message : e);
    // Falha não pode derrubar a tela de Expenses — devolve vazio.
    return NextResponse.json({ ok: true, visits: [], count: 0, source: null, updatedAt: null });
  }
}
