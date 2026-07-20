import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';

export const dynamic = 'force-dynamic';

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * GET /api/results/gl-analysis?clientId=
 * Estudo do GL (Results): Aluguel recebido (4100) × Management fee (6111) × Repasse ao owner (3250),
 * agregado por MÊS-CALENDÁRIO (data da transação) e por CASA. Somente leitura. Precisa do GL importado
 * (PropertyGlTxn) — reimporte o GL para popular também o 6111.
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  try {
    const url = new URL(req.url);
    const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
    if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

    const txns = await prisma.propertyGlTxn.findMany({
      where: { clientId: scope.clientId },
      select: { propertyId: true, propertyLabel: true, kind: true, amount: true, txnDate: true },
    });

    type Bucket = { rent: number; mgm: number; rep: number; rentCount: number };
    const mk = (): Bucket => ({ rent: 0, mgm: 0, rep: 0, rentCount: 0 });
    const byMonth = new Map<string, Bucket>();
    const byProp = new Map<string, Bucket & { propertyId: string | null; code: string; name: string }>();
    // month -> (property -> {rent, rep}) para contar casas pagas x não pagas por mês.
    const monthProp = new Map<string, Map<string, { rent: number; rep: number }>>();

    for (const t of txns) {
      const amt = Number(t.amount);
      const cal = t.txnDate.toISOString().slice(0, 7); // YYYY-MM (calendário)
      const bm = byMonth.get(cal) || mk();
      const pkey = t.propertyId || `__u__:${t.propertyLabel}`;
      const bp = byProp.get(pkey) || Object.assign(mk(), { propertyId: t.propertyId, code: '', name: t.propertyLabel });
      if (t.kind === 'RECEIVED') { bm.rent += amt; bp.rent += amt; bm.rentCount += 1; bp.rentCount += 1; }
      else if (t.kind === 'MGM_FEE') { bm.mgm += amt; bp.mgm += amt; }
      else if (t.kind === 'SENT') { bm.rep += amt; bp.rep += amt; }
      byMonth.set(cal, bm);
      byProp.set(pkey, bp);
      const mp = monthProp.get(cal) || new Map<string, { rent: number; rep: number }>();
      const cell = mp.get(pkey) || { rent: 0, rep: 0 };
      if (t.kind === 'RECEIVED') cell.rent += amt;
      else if (t.kind === 'SENT') cell.rep += amt;
      mp.set(pkey, cell);
      monthProp.set(cal, mp);
    }

    // Código + nome + % de gestão cadastrado das casas casadas.
    const feePctById = new Map<string, number>();
    const ids = [...byProp.values()].map((v) => v.propertyId).filter((x): x is string => !!x);
    if (ids.length) {
      const props = await prisma.property.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, address: true, mgmtFeePct: true } });
      const byId = new Map(props.map((p) => [p.id, p]));
      for (const v of byProp.values()) {
        const p = v.propertyId ? byId.get(v.propertyId) : null;
        if (p) { v.code = p.code || ''; v.name = p.address || v.name; feePctById.set(v.propertyId as string, Number(p.mgmtFeePct ?? 0)); }
      }
    }
    // Regra do fee: fora de 0–30 → default 8% (igual Owner Statement / lib.generalLedger).
    const effPct = (raw: number) => (!Number.isFinite(raw) || raw < 0 || raw > 30 ? 8 : raw);

    const months = [...byMonth.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, b]) => {
        const mp = monthProp.get(month) || new Map();
        let paid = 0, pendingPayout = 0, rented = 0;
        for (const cell of mp.values()) {
          if (cell.rent > 0) rented += 1;
          if (cell.rep > 0) paid += 1;
          else if (cell.rent > 0) pendingPayout += 1;
        }
        return {
          month,
          rent: round2(b.rent),
          mgm: round2(b.mgm),
          rep: round2(b.rep),
          mgmPct: b.rent ? round2((b.mgm / b.rent) * 100) : 0,
          repPct: b.rent ? round2((b.rep / b.rent) * 100) : 0,
          rentCount: b.rentCount,
          rentedHouses: rented,
          paidHouses: paid,
          pendingPayoutHouses: pendingPayout,
        };
      });

    const properties = [...byProp.values()]
      .map((v) => {
        const rent = round2(v.rent);
        const mgmCharged = round2(v.mgm);
        const regPct = v.propertyId ? effPct(feePctById.get(v.propertyId) ?? 8) : 8;
        const feeExpected = round2((rent * regPct) / 100);
        return {
          propertyId: v.propertyId,
          code: v.code,
          name: v.name,
          matched: !!v.propertyId,
          rent,
          mgm: mgmCharged,
          rep: round2(v.rep),
          mgmPct: rent ? round2((mgmCharged / rent) * 100) : 0,
          regPct,
          feeExpected,
          feeDiff: round2(mgmCharged - feeExpected),
        };
      })
      .sort((a, b) => b.rent - a.rent);

    const tRent = round2(properties.reduce((s, p) => s + p.rent, 0));
    const tMgm = round2(properties.reduce((s, p) => s + p.mgm, 0));
    const tRep = round2(properties.reduce((s, p) => s + p.rep, 0));
    const tFeeExpected = round2(properties.reduce((s, p) => s + p.feeExpected, 0));

    return NextResponse.json({
      ok: true,
      totals: {
        rent: tRent, mgm: tMgm, rep: tRep,
        mgmPct: tRent ? round2((tMgm / tRent) * 100) : 0,
        repPct: tRent ? round2((tRep / tRent) * 100) : 0,
        feeExpected: tFeeExpected,
        feeDiff: round2(tMgm - tFeeExpected),
        properties: properties.length,
      },
      months,
      properties,
    });
  } catch (e) {
    console.error('[GET /api/results/gl-analysis]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Falha ao carregar o estudo do GL.' }, { status: 500 });
  }
}
