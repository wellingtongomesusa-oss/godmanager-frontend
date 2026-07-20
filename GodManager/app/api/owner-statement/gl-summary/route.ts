import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';

export const dynamic = 'force-dynamic';

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * GET /api/owner-statement/gl-summary?periodMonth=YYYY-MM[&clientId=]
 * Resumo do GL por casa no ciclo 15-a-15: quanto cada casa RECEBEU de aluguel (4100) e quanto foi
 * PAGO ao owner (3250). Inclui um bucket "sem casa" (GL que não casou com nenhuma Property) para
 * diagnóstico. Somente leitura.
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  try {
    const url = new URL(req.url);
    const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
    if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

    const periodMonth = (url.searchParams.get('periodMonth') || '').trim();
    if (!YEAR_MONTH.test(periodMonth)) {
      return NextResponse.json({ ok: false, error: 'periodMonth inválido (YYYY-MM).' }, { status: 400 });
    }

    const txns = await prisma.propertyGlTxn.findMany({
      where: { clientId: scope.clientId, periodMonth },
      select: { propertyId: true, propertyLabel: true, kind: true, amount: true },
    });

    // Agrega por casa (propertyId), + bucket sem casa (propertyId null).
    const byProp = new Map<string, { propertyId: string | null; label: string; received: number; sent: number }>();
    const UNMATCHED = '__unmatched__';
    for (const t of txns) {
      const key = t.propertyId || UNMATCHED;
      const cur = byProp.get(key) || { propertyId: t.propertyId, label: t.propertyLabel, received: 0, sent: 0 };
      const amt = Number(t.amount);
      if (t.kind === 'RECEIVED') cur.received += amt;
      else if (t.kind === 'SENT') cur.sent += amt;
      byProp.set(key, cur);
    }

    // Nomes bonitos das casas casadas.
    const ids = [...byProp.values()].map((v) => v.propertyId).filter((x): x is string => !!x);
    if (ids.length) {
      const props = await prisma.property.findMany({
        where: { id: { in: ids } },
        select: { id: true, code: true, address: true },
      });
      const nameById = new Map(props.map((p) => [p.id, p.code || p.address || '']));
      for (const v of byProp.values()) {
        if (v.propertyId && nameById.get(v.propertyId)) v.label = nameById.get(v.propertyId) as string;
      }
    }

    const all = [...byProp.values()].map((v) => ({
      propertyId: v.propertyId,
      label: v.label,
      matched: !!v.propertyId,
      received: round2(v.received),
      sent: round2(v.sent),
    }));
    const rows = all.filter((r) => r.matched).sort((a, b) => b.received - a.received);
    const unmatched = all.filter((r) => !r.matched);

    return NextResponse.json({
      ok: true,
      periodMonth,
      count: rows.length,
      rows,
      unmatched,
      totals: {
        received: round2(all.reduce((s, r) => s + r.received, 0)),
        sent: round2(all.reduce((s, r) => s + r.sent, 0)),
        matchedReceived: round2(rows.reduce((s, r) => s + r.received, 0)),
        matchedSent: round2(rows.reduce((s, r) => s + r.sent, 0)),
        unmatchedReceived: round2(unmatched.reduce((s, r) => s + r.received, 0)),
        unmatchedSent: round2(unmatched.reduce((s, r) => s + r.sent, 0)),
      },
    });
  } catch (e) {
    console.error('[GET /api/owner-statement/gl-summary]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Falha ao carregar o resumo do GL.' }, { status: 500 });
  }
}
