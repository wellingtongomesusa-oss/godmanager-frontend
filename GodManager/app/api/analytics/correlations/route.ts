import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';

export const dynamic = 'force-dynamic';

const round2 = (n: number) => Math.round(n * 100) / 100;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Coeficiente de correlação de Pearson; null se n<3 ou variância zero. */
function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 3 || ys.length !== n) return null;
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  return Math.max(-1, Math.min(1, num / Math.sqrt(dx * dy)));
}

function strengthPt(r: number | null): string {
  if (r === null) return 'dados insuficientes';
  const a = Math.abs(r);
  const dir = r >= 0 ? 'positiva' : 'negativa';
  if (a < 0.2) return 'sem correlação relevante';
  if (a < 0.4) return `correlação ${dir} fraca`;
  if (a < 0.6) return `correlação ${dir} moderada`;
  if (a < 0.8) return `correlação ${dir} forte`;
  return `correlação ${dir} muito forte`;
}

/**
 * GET /api/analytics/correlations?clientId=
 * "Dados conectados & correlações" (#46): junta GL (aluguel recebido / repasse / mgm fee) com
 * despesas/chamados (PmExpense) POR IMÓVEL e cruza os sinais. Somente leitura.
 *  - razão manutenção/receita por casa (quais consomem a margem)
 *  - lag médio recebimento→repasse (dias) por casa
 *  - correlações de Pearson: receita × custo de manutenção, nº de chamados × receita,
 *    fee cobrado × receita
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  try {
    const url = new URL(req.url);
    const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
    if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

    const [glTxns, expenses] = await Promise.all([
      prisma.propertyGlTxn.findMany({
        where: { clientId: scope.clientId },
        select: { propertyId: true, propertyLabel: true, kind: true, amount: true, txnDate: true, periodMonth: true },
      }),
      prisma.pmExpense.findMany({
        where: { clientId: scope.clientId },
        select: { propertyId: true, vendorCost: true, ownerCharged: true, status: true, createdAt: true },
      }),
    ]);

    type Agg = {
      propertyId: string | null;
      name: string;
      rent: number;
      sent: number;
      mgm: number;
      jobs: number;
      maint: number; // vendorCost total (custo de manutenção)
      charged: number; // ownerCharged total (repassado ao owner via despesa)
      // para lag: por mês, média das datas de RECEIVED e de SENT
      recvByMonth: Map<string, { sum: number; n: number }>;
      sentByMonth: Map<string, { sum: number; n: number }>;
    };
    const agg = new Map<string, Agg>();
    const mk = (pid: string | null, name: string): Agg => ({
      propertyId: pid, name, rent: 0, sent: 0, mgm: 0, jobs: 0, maint: 0, charged: 0,
      recvByMonth: new Map(), sentByMonth: new Map(),
    });
    const keyOf = (pid: string | null, label: string) => pid || `__u__:${label}`;

    for (const t of glTxns) {
      const k = keyOf(t.propertyId, t.propertyLabel);
      const a = agg.get(k) || mk(t.propertyId, t.propertyLabel);
      const amt = Number(t.amount);
      const days = t.txnDate.getTime() / DAY_MS;
      if (t.kind === 'RECEIVED') {
        a.rent += amt;
        const m = a.recvByMonth.get(t.periodMonth) || { sum: 0, n: 0 };
        m.sum += days; m.n += 1; a.recvByMonth.set(t.periodMonth, m);
      } else if (t.kind === 'SENT') {
        a.sent += amt;
        const m = a.sentByMonth.get(t.periodMonth) || { sum: 0, n: 0 };
        m.sum += days; m.n += 1; a.sentByMonth.set(t.periodMonth, m);
      } else if (t.kind === 'MGM_FEE') {
        a.mgm += amt;
      }
      agg.set(k, a);
    }
    for (const e of expenses) {
      if (!e.propertyId) continue;
      const a = agg.get(e.propertyId) || mk(e.propertyId, e.propertyId);
      a.jobs += 1;
      a.maint += Number(e.vendorCost);
      a.charged += Number(e.ownerCharged);
      agg.set(e.propertyId, a);
    }

    // Nome/código legível das casas casadas.
    const ids = [...agg.values()].map((v) => v.propertyId).filter((x): x is string => !!x);
    if (ids.length) {
      const props = await prisma.property.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, address: true } });
      const byId = new Map(props.map((p) => [p.id, p]));
      for (const v of agg.values()) {
        const p = v.propertyId ? byId.get(v.propertyId) : null;
        if (p) v.name = p.address || p.code || v.name;
      }
    }

    const rows = [...agg.values()].map((v) => {
      // lag médio (dias) recebimento→repasse, por mês com ambos os lados.
      let lagSum = 0;
      let lagN = 0;
      for (const [month, r] of v.recvByMonth) {
        const s = v.sentByMonth.get(month);
        if (s && r.n && s.n) { lagSum += s.sum / s.n - r.sum / r.n; lagN += 1; }
      }
      const lagDays = lagN ? round2(lagSum / lagN) : null;
      const rent = round2(v.rent);
      const maint = round2(v.maint);
      return {
        propertyId: v.propertyId,
        name: v.name,
        matched: !!v.propertyId,
        rent,
        sent: round2(v.sent),
        mgm: round2(v.mgm),
        jobs: v.jobs,
        maint,
        maintRatioPct: rent > 0 ? round2((maint / rent) * 100) : null,
        lagDays,
      };
    });

    // Correlações globais (só casas com receita registrada, para não enviesar).
    const withRent = rows.filter((r) => r.rent > 0);
    const corr = {
      rentVsMaint: pearson(withRent.map((r) => r.rent), withRent.map((r) => r.maint)),
      jobsVsRent: pearson(withRent.map((r) => r.jobs), withRent.map((r) => r.rent)),
      feeVsRent: pearson(withRent.map((r) => r.rent), withRent.map((r) => r.mgm)),
    };
    const correlations = [
      { key: 'rentVsMaint', label: 'Receita × Custo de manutenção', r: corr.rentVsMaint, note: strengthPt(corr.rentVsMaint) },
      { key: 'jobsVsRent', label: 'Nº de chamados × Receita', r: corr.jobsVsRent, note: strengthPt(corr.jobsVsRent) },
      { key: 'feeVsRent', label: 'Management fee × Receita', r: corr.feeVsRent, note: strengthPt(corr.feeVsRent) },
    ].map((c) => ({ ...c, r: c.r === null ? null : round2(c.r) }));

    const topMaintRatio = [...rows].filter((r) => r.maintRatioPct !== null).sort((a, b) => (b.maintRatioPct as number) - (a.maintRatioPct as number)).slice(0, 10);
    const topLag = [...rows].filter((r) => r.lagDays !== null).sort((a, b) => (b.lagDays as number) - (a.lagDays as number)).slice(0, 10);
    const topJobs = [...rows].filter((r) => r.jobs > 0).sort((a, b) => b.jobs - a.jobs).slice(0, 10);

    const totalRent = round2(rows.reduce((s, r) => s + r.rent, 0));
    const totalMaint = round2(rows.reduce((s, r) => s + r.maint, 0));

    return NextResponse.json({
      ok: true,
      totals: {
        properties: rows.length,
        matched: rows.filter((r) => r.matched).length,
        rent: totalRent,
        maint: totalMaint,
        maintRatioPct: totalRent > 0 ? round2((totalMaint / totalRent) * 100) : null,
      },
      correlations,
      topMaintRatio,
      topLag,
      topJobs,
      properties: rows.sort((a, b) => b.rent - a.rent),
    });
  } catch (e) {
    console.error('[GET /api/analytics/correlations]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Falha ao calcular correlações.' }, { status: 500 });
  }
}
