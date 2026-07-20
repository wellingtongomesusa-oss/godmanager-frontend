import { NextResponse } from 'next/server';
import { csrfGuard } from '@/lib/csrfGuard';
import { rateLimitGuard } from '@/lib/apiRateLimit';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';

export const dynamic = 'force-dynamic';

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * GET /api/owner-statement/gl-entries?propertyId=&periodMonth=YYYY-MM&kind=RECEIVED|SENT[&clientId=]
 * Linhas do GL (RECEBIDO 4100 / ENVIADO 3250) de uma casa num ciclo 15-a-15. Somente leitura.
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  try {
    const url = new URL(req.url);
    const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
    if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

    const propertyId = (url.searchParams.get('propertyId') || '').trim();
    const periodMonth = (url.searchParams.get('periodMonth') || '').trim();
    const kind = (url.searchParams.get('kind') || '').trim().toUpperCase();
    if (!propertyId) return NextResponse.json({ ok: false, error: 'propertyId obrigatório.' }, { status: 400 });
    if (!YEAR_MONTH.test(periodMonth)) return NextResponse.json({ ok: false, error: 'periodMonth inválido (YYYY-MM).' }, { status: 400 });
    const where: Record<string, unknown> = { clientId: scope.clientId, propertyId, periodMonth };
    if (kind === 'RECEIVED' || kind === 'SENT') where.kind = kind;

    const rows = await prisma.propertyGlTxn.findMany({
      where,
      orderBy: [{ txnDate: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true, txnDate: true, account: true, kind: true, amount: true,
        payerPayee: true, reference: true, description: true, tipo: true,
      },
    });

    const entries = rows.map((r) => ({
      id: r.id,
      date: r.txnDate.toISOString().slice(0, 10),
      account: r.account,
      kind: r.kind,
      amount: Number(r.amount).toFixed(2),
      payerPayee: r.payerPayee || '',
      reference: r.reference || '',
      description: r.description || '',
      tipo: r.tipo || '',
    }));
    const total = entries.reduce((s, e) => s + Number(e.amount), 0);

    return NextResponse.json({ ok: true, count: entries.length, total: Math.round(total * 100) / 100, entries });
  } catch (e) {
    console.error('[GET /api/owner-statement/gl-entries]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Falha ao carregar o GL.' }, { status: 500 });
  }
}

/** PATCH { id, tipo } — define o "tipo de recebimento" de uma linha. */
export async function PATCH(req: Request) {
  const bad = csrfGuard(req);
  if (bad) return bad;
  const rl = rateLimitGuard(req);
  if (rl) return rl;
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  try {
    const body = (await req.json().catch(() => ({}))) as { id?: string; tipo?: string; clientId?: string };
    const id = String(body?.id || '').trim();
    if (!id) return NextResponse.json({ ok: false, error: 'id obrigatório.' }, { status: 400 });

    const scope = await resolveBankAccountClientScope(user, body?.clientId ?? null);
    if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

    const row = await prisma.propertyGlTxn.findUnique({ where: { id }, select: { clientId: true } });
    if (!row || row.clientId !== scope.clientId) {
      return NextResponse.json({ ok: false, error: 'Linha não encontrada.' }, { status: 404 });
    }

    const updated = await prisma.propertyGlTxn.update({
      where: { id },
      data: { tipo: String(body?.tipo || '').slice(0, 60) || null },
      select: { id: true, tipo: true },
    });
    return NextResponse.json({ ok: true, id: updated.id, tipo: updated.tipo || '' });
  } catch (e) {
    console.error('[PATCH /api/owner-statement/gl-entries]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Falha ao atualizar.' }, { status: 500 });
  }
}
