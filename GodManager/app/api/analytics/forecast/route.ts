import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveAnalyticsClientId } from '@/lib/analyticsResolveClientId';
import { Prisma, UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

type HistRow = {
  period: string;
  debit: number;
  credit: number;
  net: number;
  count: number;
};

// GET /api/analytics/forecast?horizon=3
export async function GET(req: Request) {
  try {
    const user = await getCurrentUserFromSession();
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    if (user.role !== UserRole.super_admin) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const clientId = await resolveAnalyticsClientId(user, req);
    if (!clientId) return NextResponse.json({ ok: false, error: 'No clientId' }, { status: 400 });

    const url = new URL(req.url);
    const horizon = Math.min(12, Math.max(1, parseInt(url.searchParams.get('horizon') || '3', 10)));

    const monthsAgg = await prisma.$queryRaw<
      { period: string; debit: unknown; credit: unknown; cnt: bigint }[]
    >(Prisma.sql`
      SELECT
        TO_CHAR(e."entryDate", 'YYYY-MM') AS period,
        COALESCE(SUM(e.debit), 0) AS debit,
        COALESCE(SUM(e.credit), 0) AS credit,
        COUNT(*)::bigint AS cnt
      FROM gl_entries e
      WHERE e."clientId" = ${clientId}
        AND e."entryDate" >= NOW() - INTERVAL '18 months'
      GROUP BY period
      ORDER BY period ASC
    `);

    const history: HistRow[] = monthsAgg.map((m) => ({
      period: m.period,
      debit: Number(m.debit || 0),
      credit: Number(m.credit || 0),
      net: Number(m.credit || 0) - Number(m.debit || 0),
      count: Number(m.cnt),
    }));

    if (history.length < 3) {
      return NextResponse.json({
        ok: true,
        history,
        forecast: [],
        horizon,
        note: 'Histórico insuficiente para previsão (mínimo 3 meses).',
      });
    }

    const recentN = Math.min(6, history.length);
    const recent = history.slice(-recentN);
    const weights = recent.map((_, i) => i + 1);
    const weightSum = weights.reduce((a, b) => a + b, 0);

    function weightedAvg(field: keyof Pick<HistRow, 'debit' | 'credit' | 'count'>) {
      return recent.reduce((sum, m, i) => sum + Number(m[field]) * weights[i], 0) / weightSum;
    }

    const baseDebit = weightedAvg('debit');
    const baseCredit = weightedAvg('credit');
    const baseCount = Math.round(weightedAvg('count'));

    function seasonalFactor(targetMonth: number): { debit: number; credit: number } {
      const sameMonths = history.filter((h) => {
        const m = parseInt(h.period.slice(5, 7), 10);
        return m === targetMonth;
      });
      if (sameMonths.length === 0) return { debit: 1, credit: 1 };
      const avgD = sameMonths.reduce((a, b) => a + b.debit, 0) / sameMonths.length;
      const avgC = sameMonths.reduce((a, b) => a + b.credit, 0) / sameMonths.length;
      const globalD = history.reduce((a, b) => a + b.debit, 0) / history.length;
      const globalC = history.reduce((a, b) => a + b.credit, 0) / history.length;
      return {
        debit: globalD > 0 ? avgD / globalD : 1,
        credit: globalC > 0 ? avgC / globalC : 1,
      };
    }

    const lastPeriod = history[history.length - 1].period;
    const [ly, lm] = lastPeriod.split('-').map(Number);
    const forecast: Array<{
      period: string;
      debit: string;
      credit: string;
      net: string;
      debitLow: string;
      debitHigh: string;
      creditLow: string;
      creditHigh: string;
      confidence: number;
      seasonalFactor: { debit: string; credit: string };
    }> = [];

    for (let i = 1; i <= horizon; i++) {
      const date = new Date(Date.UTC(ly, lm - 1 + i, 1));
      const ym = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      const monthNum = date.getUTCMonth() + 1;
      const factor = seasonalFactor(monthNum);

      const predDebit = baseDebit * factor.debit;
      const predCredit = baseCredit * factor.credit;
      const predNet = predCredit - predDebit;

      const confidence = history.length >= 12 ? 0.85 : 0.7;
      const margin = 0.2;

      forecast.push({
        period: ym,
        debit: predDebit.toFixed(2),
        credit: predCredit.toFixed(2),
        net: predNet.toFixed(2),
        debitLow: (predDebit * (1 - margin)).toFixed(2),
        debitHigh: (predDebit * (1 + margin)).toFixed(2),
        creditLow: (predCredit * (1 - margin)).toFixed(2),
        creditHigh: (predCredit * (1 + margin)).toFixed(2),
        confidence,
        seasonalFactor: { debit: factor.debit.toFixed(3), credit: factor.credit.toFixed(3) },
      });
    }

    return NextResponse.json({
      ok: true,
      horizon,
      historyMonths: history.length,
      baseDebit: baseDebit.toFixed(2),
      baseCredit: baseCredit.toFixed(2),
      baseCount,
      method: 'weighted_moving_avg_6mo + seasonal_factor',
      history: history.map((h) => ({
        period: h.period,
        debit: h.debit.toFixed(2),
        credit: h.credit.toFixed(2),
        net: h.net.toFixed(2),
        count: h.count,
      })),
      forecast,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown';
    console.error('forecast error:', e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
