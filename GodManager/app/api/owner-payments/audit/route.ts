import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveAnalyticsClientId } from '@/lib/analyticsResolveClientId';
import { UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function glLineAmount(d: unknown, c: unknown): number {
  const debit = Number(d ?? 0);
  const credit = Number(c ?? 0);
  if (debit > 0) return debit;
  if (credit > 0) return credit;
  return 0;
}

// GET /api/owner-payments/audit?period=YYYY-MM
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
    const period = url.searchParams.get('period');
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json({ ok: false, error: 'period required as YYYY-MM' }, { status: 400 });
    }
    const [y, m] = period.split('-').map(Number);
    const startMonth = new Date(Date.UTC(y, m - 1, 1));
    const endMonth = new Date(Date.UTC(y, m, 1));

    const payouts = await prisma.ownerMonthPayout.findMany({
      where: { clientId, yearMonth: period },
      include: {
        property: {
          select: {
            id: true,
            address: true,
            code: true,
            ownerId: true,
            ownerName: true,
            owner: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    const glEntries = await prisma.gLEntry.findMany({
      where: {
        clientId,
        accountCode: '3250',
        entryDate: { gte: startMonth, lt: endMonth },
      },
      select: {
        id: true,
        entryDate: true,
        payee: true,
        propertyAddress: true,
        debit: true,
        credit: true,
        description: true,
        reference: true,
      },
    });

    type AuditRow = {
      propertyId: string;
      propertyName: string;
      propertyAddress: string;
      ownerName: string;
      ownerEmail?: string;
      godmanagerAmount: number;
      godmanagerPaidAt: Date | null;
      appfolioAmount: number;
      appfolioEntryIds: string[];
      diff: number;
      status: 'OK' | 'DIVERGENCE' | 'MISSING_APPFOLIO' | 'MISSING_GODMANAGER';
    };

    const rows: AuditRow[] = [];
    const matchedGLIds = new Set<string>();

    for (const po of payouts) {
      const prop = po.property;
      const ownerName =
        prop?.owner?.name?.trim() ||
        prop?.ownerName?.trim() ||
        (prop?.ownerId ? '(owner link)' : '(no owner)');
      const propAddr = prop?.address || '';
      const propLabel =
        [prop?.code?.trim(), propAddr.trim()].filter(Boolean).join(' — ') ||
        '(no property)';

      const normAddr = normalize(propAddr);
      const normOwner = normalize(ownerName);

      const candidateGL = glEntries.filter((g) => {
        if (matchedGLIds.has(g.id)) return false;
        const ga = normalize(g.propertyAddress || '');
        const gp = normalize(g.payee || '');
        const addrMatch =
          Boolean(normAddr && ga && (ga === normAddr || ga.includes(normAddr) || normAddr.includes(ga)));
        const ownerMatch =
          Boolean(normOwner.length > 4 && gp && (gp.includes(normOwner) || normOwner.includes(gp)));
        return addrMatch || ownerMatch;
      });

      let glAmount = 0;
      const glIds: string[] = [];
      for (const g of candidateGL) {
        glAmount += glLineAmount(g.debit, g.credit);
        glIds.push(g.id);
        matchedGLIds.add(g.id);
      }

      const gmAmount = Number(po.paidAmount ?? 0);

      const diff = gmAmount - glAmount;

      if (gmAmount === 0 && glAmount === 0) continue;

      let status: AuditRow['status'];
      if (Math.abs(diff) < 1) status = 'OK';
      else if (gmAmount > 0 && glAmount === 0) status = 'MISSING_APPFOLIO';
      else if (gmAmount === 0 && glAmount > 0) status = 'MISSING_GODMANAGER';
      else status = 'DIVERGENCE';

      rows.push({
        propertyId: po.propertyId,
        propertyName: propLabel,
        propertyAddress: propAddr,
        ownerName,
        ownerEmail: prop?.owner?.email ?? undefined,
        godmanagerAmount: gmAmount,
        godmanagerPaidAt: po.paidAt,
        appfolioAmount: glAmount,
        appfolioEntryIds: glIds,
        diff,
        status,
      });
    }

    const orphanGL = glEntries.filter((g) => !matchedGLIds.has(g.id));
    for (const g of orphanGL) {
      const amt = glLineAmount(g.debit, g.credit);
      if (amt === 0) continue;
      rows.push({
        propertyId: '',
        propertyName: '(sem property)',
        propertyAddress: g.propertyAddress || '',
        ownerName: g.payee || '(sem payee)',
        godmanagerAmount: 0,
        godmanagerPaidAt: null,
        appfolioAmount: amt,
        appfolioEntryIds: [g.id],
        diff: -amt,
        status: 'MISSING_GODMANAGER',
      });
    }

    const summary = {
      period,
      totalRows: rows.length,
      ok: rows.filter((r) => r.status === 'OK').length,
      divergence: rows.filter((r) => r.status === 'DIVERGENCE').length,
      missingAppfolio: rows.filter((r) => r.status === 'MISSING_APPFOLIO').length,
      missingGodmanager: rows.filter((r) => r.status === 'MISSING_GODMANAGER').length,
      godmanagerTotal: rows.reduce((a, r) => a + r.godmanagerAmount, 0).toFixed(2),
      appfolioTotal: rows.reduce((a, r) => a + r.appfolioAmount, 0).toFixed(2),
      totalDiff: rows.reduce((a, r) => a + r.diff, 0).toFixed(2),
    };

    const statusOrder: Record<string, number> = {
      DIVERGENCE: 0,
      MISSING_APPFOLIO: 1,
      MISSING_GODMANAGER: 2,
      OK: 3,
    };
    rows.sort(
      (a, b) =>
        statusOrder[a.status] - statusOrder[b.status] || b.godmanagerAmount - a.godmanagerAmount,
    );

    return NextResponse.json({
      ok: true,
      summary,
      rows: rows.map((r) => ({
        ...r,
        godmanagerPaidAt: r.godmanagerPaidAt?.toISOString() ?? null,
        godmanagerAmount: r.godmanagerAmount.toFixed(2),
        appfolioAmount: r.appfolioAmount.toFixed(2),
        diff: r.diff.toFixed(2),
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    console.error('[owner-payments audit]', e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
