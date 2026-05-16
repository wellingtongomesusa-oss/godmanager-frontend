import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const cpaAccounts: Record<string, string[]> = {
  rentIncome: ['4100'],
  ownerDistrib: ['3250'],
  mgmtFees: ['6111'],
  hoaDues: ['6075'],
  secDeposits: ['1160', '2101', '2103', '2105'],
};

// GET /api/analytics/snapshot?secret=...
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const secret = url.searchParams.get('secret');
    const expected = process.env.CRON_SECRET;
    if (!expected || !secret || secret !== expected) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const clients = await prisma.client.findMany({ select: { id: true, companyName: true } });
    type ResultRow = {
      clientId: string;
      clientName: string;
      periodYM: string;
      count: number;
      debit: string;
      credit: string;
      net: string;
      netChangePct: string;
      alerts: string[];
    };

    const results: ResultRow[] = [];

    for (const client of clients) {
      const periodYM = new Date().toISOString().slice(0, 7);
      const [y, m] = periodYM.split('-').map(Number);
      const startMonth = new Date(Date.UTC(y, m - 1, 1));
      const endMonth = new Date(Date.UTC(y, m, 1));

      const monthAgg = await prisma.gLEntry.aggregate({
        where: {
          clientId: client.id,
          entryDate: { gte: startMonth, lt: endMonth },
        },
        _sum: { debit: true, credit: true },
        _count: { _all: true },
      });

      const debit = Number(monthAgg._sum.debit || 0);
      const credit = Number(monthAgg._sum.credit || 0);
      const net = credit - debit;
      const count = monthAgg._count._all;

      const metrics: Record<string, { sum: number; count: number }> = {};
      for (const [k, codes] of Object.entries(cpaAccounts)) {
        const agg = await prisma.gLEntry.aggregate({
          where: {
            clientId: client.id,
            accountCode: { in: [...codes] },
            entryDate: { gte: startMonth, lt: endMonth },
          },
          _sum: { debit: true, credit: true },
          _count: { _all: true },
        });
        const d = Number(agg._sum.debit || 0);
        const c = Number(agg._sum.credit || 0);
        metrics[k] = { sum: Math.max(d, c), count: agg._count._all };
      }

      const prevStart = new Date(Date.UTC(y, m - 2, 1));
      const prevAgg = await prisma.gLEntry.aggregate({
        where: { clientId: client.id, entryDate: { gte: prevStart, lt: startMonth } },
        _sum: { debit: true, credit: true },
        _count: { _all: true },
      });
      const prevDebit = Number(prevAgg._sum.debit || 0);
      const prevNet = Number(prevAgg._sum.credit || 0) - prevDebit;

      const netChange = prevNet !== 0 ? ((net - prevNet) / Math.abs(prevNet)) * 100 : 0;

      await prisma.analyticsSnapshot.deleteMany({
        where: { clientId: client.id, periodYM },
      });

      const snapshotRows: Array<{
        metricKey: string;
        metricLabel: string;
        metricValue: Prisma.Decimal | null;
        metricQty: number | null;
        metadata: Prisma.InputJsonValue | typeof Prisma.JsonNull;
      }> = [
        {
          metricKey: 'total_entries',
          metricLabel: 'Total Lançamentos',
          metricValue: null,
          metricQty: count,
          metadata: { debit, credit, net } as Prisma.InputJsonValue,
        },
        {
          metricKey: 'total_debit',
          metricLabel: 'Total Débito',
          metricValue: new Prisma.Decimal(debit),
          metricQty: null,
          metadata: Prisma.JsonNull,
        },
        {
          metricKey: 'total_credit',
          metricLabel: 'Total Crédito',
          metricValue: new Prisma.Decimal(credit),
          metricQty: null,
          metadata: Prisma.JsonNull,
        },
        {
          metricKey: 'net',
          metricLabel: 'Net',
          metricValue: new Prisma.Decimal(net),
          metricQty: null,
          metadata: { changePct: netChange.toFixed(2) } as Prisma.InputJsonValue,
        },
      ];

      for (const [k, v] of Object.entries(metrics)) {
        snapshotRows.push({
          metricKey: `cpa_${k}`,
          metricLabel: k,
          metricValue: new Prisma.Decimal(v.sum),
          metricQty: v.count,
          metadata: Prisma.JsonNull,
        });
      }

      await prisma.analyticsSnapshot.createMany({
        data: snapshotRows.map((s) => ({
          ...s,
          clientId: client.id,
          periodYM,
        })),
      });

      const alerts: string[] = [];
      if (Math.abs(netChange) >= 30 && prevNet !== 0) {
        alerts.push(
          `Net variou ${netChange.toFixed(1)}% vs mês anterior (de $${prevNet.toFixed(2)} para $${net.toFixed(2)})`,
        );
      }
      if (net < 0) {
        alerts.push(`Cash flow negativo no mês: $${net.toFixed(2)}`);
      }

      if (alerts.length > 0) {
        const tenantSuper = await prisma.user.findFirst({
          where: {
            clientId: client.id,
            role: UserRole.super_admin,
            status: UserStatus.active,
          },
          select: { email: true },
        });
        const globalSuper = await prisma.user.findFirst({
          where: {
            role: UserRole.super_admin,
            status: UserStatus.active,
            clientId: null,
          },
          select: { email: true },
          orderBy: { createdAt: 'asc' },
        });
        const fallbackEmail =
          process.env.ANALYTICS_ALERT_EMAIL || process.env.RESEND_FROM_EMAIL || '';

        const to =
          tenantSuper?.email?.trim() || globalSuper?.email?.trim() || fallbackEmail.trim() || null;

        if (to) {
          const htmlBody = `<h2>Analytics — Alertas ${escapeHtml(periodYM)}</h2>
<p><strong>Cliente:</strong> ${escapeHtml(client.companyName)}</p>
<ul>${alerts.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul>
<hr>
<p style="font-size:11px;color:#64748b">Snapshot automático GodManager — ${escapeHtml(new Date().toISOString())}</p>`;

          const emailResult = await sendEmail({
            to,
            subject: `[GodManager] Analytics ${periodYM} — ${alerts.length} alerta(s)`,
            html: htmlBody,
          });
          if (!emailResult.ok) {
            console.error('[snapshot] sendEmail:', emailResult.error);
          }
        } else {
          console.warn('[snapshot] alerts present but no recipient (set ANALYTICS_ALERT_EMAIL or active super_admin user)');
        }
      }

      results.push({
        clientId: client.id,
        clientName: client.companyName,
        periodYM,
        count,
        debit: debit.toFixed(2),
        credit: credit.toFixed(2),
        net: net.toFixed(2),
        netChangePct: netChange.toFixed(2),
        alerts,
      });
    }

    return NextResponse.json({ ok: true, snapshotsCount: results.length, results });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown';
    console.error('snapshot cron error:', e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
