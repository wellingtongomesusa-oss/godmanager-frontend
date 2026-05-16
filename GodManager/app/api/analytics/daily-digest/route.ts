import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Decimal } from '@prisma/client/runtime/library';
import { UserRole, UserStatus } from '@prisma/client';
import { sendEmail } from '@/lib/email';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveAnalyticsClientId } from '@/lib/analyticsResolveClientId';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DIGEST_ANOMALY_MIN_Z = 2.5;

function fmtMoney(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeSubjectSnippet(s: string): string {
  return s.replace(/[\r\n<>&]/g, ' ').trim().slice(0, 120);
}

type AnomalyDebitRow = {
  entryDate: Date;
  payee: string | null;
  debit: Decimal | null;
};

type MonthAgg = { sum: number; count: number };

/** Payee-grouped mensal totals (débito), z sobre histórico 12 meses — só período atual, |z| >= minZ. */
function anomaliesForDigestCurrentMonth(entries: AnomalyDebitRow[], currentYm: string, minZ: number): string[] {
  const groupKey = (e: AnomalyDebitRow) => e.payee || 'UNKNOWN';

  const byGroupMonth: Record<string, Record<string, MonthAgg>> = {};

  for (const e of entries) {
    const g = groupKey(e);
    const ym = e.entryDate.toISOString().slice(0, 7);
    const dAmt = Number(e.debit || 0);
    if (!byGroupMonth[g]) byGroupMonth[g] = {};
    if (!byGroupMonth[g][ym]) {
      byGroupMonth[g][ym] = { sum: 0, count: 0 };
    }
    const bucket = byGroupMonth[g][ym];
    bucket.sum += dAmt;
    bucket.count += 1;
  }

  const lines: Array<{ absZ: number; html: string }> = [];

  for (const [grp, months] of Object.entries(byGroupMonth)) {
    const monthSums = Object.values(months).map((m) => m.sum);
    if (monthSums.length < 3) continue;

    const mean = monthSums.reduce((a, b) => a + b, 0) / monthSums.length;
    const variance = monthSums.reduce((a, b) => a + (b - mean) ** 2, 0) / monthSums.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) continue;

    const data = months[currentYm];
    if (!data) continue;

    const z = (data.sum - mean) / stdDev;
    if (Math.abs(z) < minZ) continue;

    const dir = z > 0 ? 'acima da média' : 'abaixo da média';
    lines.push({
      absZ: Math.abs(z),
      html:
        `<strong>${escapeHtml(grp)}</strong> (${escapeHtml(currentYm)}): $${fmtMoney(data.sum)} ` +
        `(${dir}, z=${z.toFixed(2)} vs média $${fmtMoney(mean)}, σ=${fmtMoney(stdDev)})`,
    });
  }

  lines.sort((a, b) => b.absZ - a.absZ);
  return lines.map((l) => l.html);
}

async function resolveDigestRecipient(
  clientId: string,
  manualEmail: string | null,
): Promise<string | null> {
  if (manualEmail?.trim()) return manualEmail.trim();

  const tenantSuper = await prisma.user.findFirst({
    where: { clientId, role: UserRole.super_admin, status: UserStatus.active },
    select: { email: true },
  });
  const globalSuper = await prisma.user.findFirst({
    where: { role: UserRole.super_admin, status: UserStatus.active, clientId: null },
    select: { email: true },
    orderBy: { createdAt: 'asc' },
  });
  const fallback = process.env.ANALYTICS_ALERT_EMAIL || process.env.RESEND_FROM_EMAIL || '';
  return tenantSuper?.email?.trim() || globalSuper?.email?.trim() || fallback.trim() || null;
}

// GET /api/analytics/daily-digest
// - ?secret=CRON_SECRET — cron (todos os clientes, envio email por tenant)
// - sessão super_admin — preview (JSON + previewHtml) se sem send
// - ?send=true + sessão — envia digest do tenant atual para o email do utilizador logado
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const secret = url.searchParams.get('secret');
    const cronSecretEnv = process.env.CRON_SECRET;
    let isCron = false;

    if (secret != null && secret !== '') {
      if (!cronSecretEnv || secret !== cronSecretEnv) {
        return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
      }
      isCron = true;
    }

    const send = url.searchParams.get('send') === 'true';

    type TargetRow = { id: string; companyName: string };
    let targetClients: TargetRow[] = [];
    let isPreview = false;
    let recipientOverride: string | null = null;

    if (isCron) {
      targetClients = await prisma.client.findMany({ select: { id: true, companyName: true } });
    } else {
      const user = await getCurrentUserFromSession();
      if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
      if (user.role !== UserRole.super_admin) {
        return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
      }

      const clientId = await resolveAnalyticsClientId(user, req);
      if (!clientId) return NextResponse.json({ ok: false, error: 'No clientId' }, { status: 400 });

      const c = await prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true, companyName: true },
      });
      if (!c) return NextResponse.json({ ok: false, error: 'Client not found' }, { status: 404 });

      targetClients = [c];
      isPreview = !send;
      recipientOverride = user.email || null;
    }

    const now = new Date();
    const yyyyMMdd = now.toISOString().slice(0, 10);
    const periodYM = yyyyMMdd.slice(0, 7);
    const [y, m] = periodYM.split('-').map(Number);
    const startMonth = new Date(Date.UTC(y, m - 1, 1));
    const endMonth = new Date(Date.UTC(y, m, 1));
    const prevStart = new Date(Date.UTC(y, m - 2, 1));
    const startDay = new Date(`${yyyyMMdd}T00:00:00.000Z`);
    const endDay = new Date(startDay.getTime() + 24 * 60 * 60 * 1000);

    const anomalyCutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, now.getUTCDate()));

    type ResultRow = {
      clientId: string;
      clientName: string;
      date: string;
      emailSent: boolean;
      emailOk?: boolean;
      emailError?: string;
      previewHtml?: string;
      kpis: {
        monthEntries: number;
        monthNet: string;
        monthNetChangePct: string;
        dayEntries: number;
        dayNet: string;
        topPayeesCount: number;
        anomaliesCount: number;
      };
    };

    const results: ResultRow[] = [];

    for (const client of targetClients) {
      const monthAgg = await prisma.gLEntry.aggregate({
        where: { clientId: client.id, entryDate: { gte: startMonth, lt: endMonth } },
        _sum: { debit: true, credit: true },
        _count: { _all: true },
      });
      const mDebit = Number(monthAgg._sum.debit || 0);
      const mCredit = Number(monthAgg._sum.credit || 0);
      const mNet = mCredit - mDebit;

      const prevAgg = await prisma.gLEntry.aggregate({
        where: { clientId: client.id, entryDate: { gte: prevStart, lt: startMonth } },
        _sum: { debit: true, credit: true },
      });
      const prevNet =
        Number(prevAgg._sum.credit || 0) - Number(prevAgg._sum.debit || 0);
      const netChange = prevNet !== 0 ? ((mNet - prevNet) / Math.abs(prevNet)) * 100 : 0;

      const dayAgg = await prisma.gLEntry.aggregate({
        where: { clientId: client.id, entryDate: { gte: startDay, lt: endDay } },
        _sum: { debit: true, credit: true },
        _count: { _all: true },
      });
      const dDebit = Number(dayAgg._sum.debit || 0);
      const dCredit = Number(dayAgg._sum.credit || 0);
      const dayNet = dCredit - dDebit;

      const dayEntries = await prisma.gLEntry.findMany({
        where: { clientId: client.id, entryDate: { gte: startDay, lt: endDay } },
        select: {
          payee: true,
          debit: true,
          credit: true,
          account: true,
          propertyAddress: true,
          entryType: true,
        },
      });
      const maxAmt = (e: { debit: Decimal | null; credit: Decimal | null }) =>
        Math.max(Number(e.debit || 0), Number(e.credit || 0));
      const topTxns = [...dayEntries].sort((a, b) => maxAmt(b) - maxAmt(a)).slice(0, 5);

      const topPayees = await prisma.gLEntry.groupBy({
        by: ['payee'],
        where: {
          clientId: client.id,
          entryDate: { gte: startMonth, lt: endMonth },
          payee: { not: null },
          debit: { gt: 0 },
        },
        _sum: { debit: true },
        _count: { _all: true },
        orderBy: { _sum: { debit: 'desc' } },
        take: 3,
      });

      const anomalyRows = await prisma.gLEntry.findMany({
        where: {
          clientId: client.id,
          entryDate: { gte: anomalyCutoff },
          debit: { gt: 0 },
        },
        select: { entryDate: true, payee: true, debit: true },
      });
      const anomalyLines = anomaliesForDigestCurrentMonth(anomalyRows, periodYM, DIGEST_ANOMALY_MIN_Z);

      const arrowNet = netChange > 0 ? '↑' : netChange < 0 ? '↓' : '';
      const colorNet = netChange > 0 ? '#059669' : netChange < 0 ? '#dc2626' : '#64748b';

      const topTxnsHtml =
        topTxns.length === 0
          ? '<p style="color:#94a3b8;font-size:13px">Nenhuma transação hoje.</p>'
          : '<table style="width:100%;border-collapse:collapse;font-size:12px">' +
            '<thead><tr style="background:#f1f5f9">' +
            '<th style="text-align:left;padding:6px 8px">Payee</th>' +
            '<th style="text-align:left;padding:6px 8px">Conta</th>' +
            '<th style="text-align:right;padding:6px 8px">Valor</th>' +
            '</tr></thead><tbody>' +
            topTxns
              .map((t) => {
                const amount = Math.max(Number(t.debit || 0), Number(t.credit || 0));
                return (
                  '<tr style="border-bottom:1px solid #e2e8f0">' +
                  `<td style="padding:6px 8px">${escapeHtml(t.payee || '—')}</td>` +
                  `<td style="padding:6px 8px;color:#64748b">${escapeHtml(t.account || '—')}</td>` +
                  `<td style="text-align:right;padding:6px 8px;font-family:monospace">$${fmtMoney(amount)}</td>` +
                  '</tr>'
                );
              })
              .join('') +
            '</tbody></table>';

      const topPayeesHtml =
        topPayees.length === 0
          ? '<p style="color:#94a3b8;font-size:13px">Sem dados.</p>'
          : '<ol style="font-size:13px;padding-left:20px;margin:0">' +
            topPayees
              .map(
                (p) =>
                  `<li><strong>${escapeHtml(p.payee || '—')}</strong> — $${fmtMoney(
                    Number(p._sum.debit || 0),
                  )} (${p._count._all} tx)</li>`,
              )
              .join('') +
            '</ol>';

      const anomaliesHtml =
        anomalyLines.length === 0
          ? '<p style="color:#94a3b8;font-size:13px">Sem anomalias novas neste período ' +
              `(critério: |z| ≥ ${DIGEST_ANOMALY_MIN_Z}).</p>`
          : '<ul style="font-size:13px;padding-left:20px;margin:0;color:#dc2626">' +
            anomalyLines.map((line) => `<li>${line}</li>`).join('') +
            '</ul>';

      const html =
        `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;padding:20px;color:#0f172a">` +
        `<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:10px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.08)">` +
        `<h2 style="margin:0 0 4px;color:#0f172a">GodManager — Daily Digest</h2>` +
        `<p style="margin:0 0 20px;color:#64748b;font-size:13px">${escapeHtml(client.companyName)} · ${escapeHtml(
          yyyyMMdd,
        )}</p>` +
        `<div style="display:flex;gap:14px;margin-bottom:20px;flex-wrap:wrap">` +
        `<div style="flex:1;min-width:120px;background:#f8fafc;padding:12px 14px;border-radius:8px">` +
        `<div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:600">Mês corrente — Net</div>` +
        `<div style="font-size:18px;font-weight:700;color:${colorNet};font-family:monospace">$${fmtMoney(mNet)}</div>` +
        `<div style="font-size:11px;color:${colorNet}">${escapeHtml(
          arrowNet + (prevNet !== 0 ? `${Math.abs(netChange).toFixed(1)}% vs anterior` : '— vs anterior'),
        )}</div>` +
        `</div>` +
        `<div style="flex:1;min-width:120px;background:#f8fafc;padding:12px 14px;border-radius:8px">` +
        `<div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:600">Hoje — Lançamentos</div>` +
        `<div style="font-size:18px;font-weight:700;font-family:monospace">${dayAgg._count._all}</div>` +
        `<div style="font-size:11px;color:#64748b">Net hoje $${fmtMoney(dayNet)}</div>` +
        `</div>` +
        `<div style="flex:1;min-width:120px;background:#f8fafc;padding:12px 14px;border-radius:8px">` +
        `<div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:600">Mês — Lançamentos</div>` +
        `<div style="font-size:18px;font-weight:700;font-family:monospace">${monthAgg._count._all}</div>` +
        `<div style="font-size:11px;color:#64748b">$${fmtMoney(mCredit)} créd / $${fmtMoney(mDebit)} déb</div>` +
        `</div></div>` +
        `<h3 style="font-size:13px;color:#475569;margin:20px 0 8px;text-transform:uppercase;letter-spacing:.3px">` +
        `Maiores transações de hoje</h3>${topTxnsHtml}` +
        `<h3 style="font-size:13px;color:#475569;margin:20px 0 8px;text-transform:uppercase;letter-spacing:.3px">` +
        `Top 3 payees do mês (débito)</h3>${topPayeesHtml}` +
        `<h3 style="font-size:13px;color:#475569;margin:20px 0 8px;text-transform:uppercase;letter-spacing:.3px">` +
        `Anomalias (${DIGEST_ANOMALY_MIN_Z}+ σ por payee, mês corrente)</h3>${anomaliesHtml}` +
        `<hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0">` +
        `<p style="font-size:11px;color:#94a3b8">Daily digest automático GodManager · ${escapeHtml(
          new Date().toISOString(),
        )}</p>` +
        `</div></body></html>`;

      let emailSent = false;
      let emailOk = false;
      let emailErr: string | undefined;

      if (!isPreview) {
        emailSent = true;

        let toEmail: string | null = null;
        if (!isCron && send) {
          toEmail = await resolveDigestRecipient(client.id, recipientOverride);
        } else if (isCron) {
          toEmail = await resolveDigestRecipient(client.id, null);
        }

        if (toEmail) {
          const sub = `[GodManager] Daily Digest ${periodYM} — ${sanitizeSubjectSnippet(client.companyName)}`;

          const res = await sendEmail({
            to: toEmail,
            subject: sub,
            html,
          });

          emailOk = res.ok;
          if (!res.ok) emailErr = res.error || 'unknown';
          if (!res.ok) console.error('[daily-digest] sendEmail:', res.error);
        } else {
          emailOk = false;
          emailErr = 'no_recipient';
          console.warn('[daily-digest] no recipient (tenant/global super_admin ou ANALYTICS_ALERT_EMAIL)');
        }
      }

      results.push({
        clientId: client.id,
        clientName: client.companyName,
        date: yyyyMMdd,
        emailSent,
        ...(emailSent ? { emailOk, ...(emailErr ? { emailError: emailErr } : {}) } : {}),
        ...(isPreview ? { previewHtml: html } : {}),
        kpis: {
          monthEntries: monthAgg._count._all,
          monthNet: mNet.toFixed(2),
          monthNetChangePct: netChange.toFixed(2),
          dayEntries: dayAgg._count._all,
          dayNet: dayNet.toFixed(2),
          topPayeesCount: topPayees.length,
          anomaliesCount: anomalyLines.length,
        },
      });
    }

    return NextResponse.json({ ok: true, digestDate: yyyyMMdd, minZ: DIGEST_ANOMALY_MIN_Z, results });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown';
    console.error('daily-digest error:', e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
