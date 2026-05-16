import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveAnalyticsClientId } from '@/lib/analyticsResolveClientId';
import { Decimal } from '@prisma/client/runtime/library';
import { UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

type GroupByMode = 'payee' | 'account';

type MonthAgg = { sum: number; count: number; entries: AnomalyEntryRow[] };

type AnomalyEntryRow = {
  id: string;
  entryDate: Date;
  payee: string | null;
  accountCode: string | null;
  account: string | null;
  debit: Decimal | null;
  description: string | null;
  propertyAddress: string;
  reference: string | null;
};

// GET /api/analytics/anomalies?minZ=2.5&groupBy=payee|account
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
    const minZ = Math.max(1.0, parseFloat(url.searchParams.get('minZ') || '2.5'));
    const rawGroup = url.searchParams.get('groupBy') || 'payee';
    const groupBy: GroupByMode = rawGroup === 'account' ? 'account' : 'payee';

    const now = new Date();
    const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, now.getUTCDate()));

    const entries = await prisma.gLEntry.findMany({
      where: {
        clientId,
        entryDate: { gte: cutoff },
        debit: { gt: 0 },
      },
      select: {
        id: true,
        entryDate: true,
        payee: true,
        accountCode: true,
        account: true,
        debit: true,
        description: true,
        propertyAddress: true,
        reference: true,
      },
    });

    if (entries.length === 0) {
      return NextResponse.json({
        ok: true,
        anomalies: [],
        totalAnalyzed: 0,
        anomaliesCount: 0,
        minZ,
        groupBy,
      });
    }

    const groupKey = (e: AnomalyEntryRow) =>
      groupBy === 'payee' ? e.payee || 'UNKNOWN' : e.accountCode || 'UNKNOWN';

    const byGroupMonth: Record<string, Record<string, MonthAgg>> = {};

    for (const e of entries) {
      const g = groupKey(e);
      const ym = e.entryDate.toISOString().slice(0, 7);
      if (!byGroupMonth[g]) byGroupMonth[g] = {};
      if (!byGroupMonth[g][ym]) {
        byGroupMonth[g][ym] = { sum: 0, count: 0, entries: [] };
      }
      const bucket = byGroupMonth[g][ym];
      bucket.sum += Number(e.debit || 0);
      bucket.count += 1;
      bucket.entries.push(e);
    }

    const anomalies: Array<{
      group: string;
      groupType: GroupByMode;
      period: string;
      sum: string;
      count: number;
      mean: string;
      stdDev: string;
      zScore: string;
      direction: 'ABOVE' | 'BELOW';
      sampleEntries: Array<{
        id: string;
        date: string;
        debit: string;
        description: string | null;
        propertyAddress: string;
        reference: string | null;
      }>;
    }> = [];

    for (const [grp, months] of Object.entries(byGroupMonth)) {
      const monthSums = Object.values(months).map((m) => m.sum);
      if (monthSums.length < 3) continue;

      const mean = monthSums.reduce((a, b) => a + b, 0) / monthSums.length;
      const variance = monthSums.reduce((a, b) => a + (b - mean) ** 2, 0) / monthSums.length;
      const stdDev = Math.sqrt(variance);
      if (stdDev === 0) continue;

      for (const [ym, data] of Object.entries(months)) {
        const z = (data.sum - mean) / stdDev;
        if (Math.abs(z) >= minZ) {
          anomalies.push({
            group: grp,
            groupType: groupBy,
            period: ym,
            sum: data.sum.toFixed(2),
            count: data.count,
            mean: mean.toFixed(2),
            stdDev: stdDev.toFixed(2),
            zScore: z.toFixed(2),
            direction: z > 0 ? 'ABOVE' : 'BELOW',
            sampleEntries: data.entries.slice(0, 5).map((row) => ({
              id: row.id,
              date: row.entryDate.toISOString().slice(0, 10),
              debit: Number(row.debit || 0).toFixed(2),
              description: row.description,
              propertyAddress: row.propertyAddress,
              reference: row.reference,
            })),
          });
        }
      }
    }

    anomalies.sort((a, b) => Math.abs(parseFloat(b.zScore)) - Math.abs(parseFloat(a.zScore)));

    return NextResponse.json({
      ok: true,
      minZ,
      groupBy,
      totalAnalyzed: entries.length,
      anomaliesCount: anomalies.length,
      anomalies: anomalies.slice(0, 100),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown';
    console.error('anomalies error:', e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
