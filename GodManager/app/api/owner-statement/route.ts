import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';
import { monthRefQueryValues } from '@/lib/pmMonthRef';
import type { Decimal } from '@prisma/client/runtime/library';

export const dynamic = 'force-dynamic';

type Meta = Record<string, unknown>;

function asMeta(m: unknown): Meta {
  if (m && typeof m === 'object' && !Array.isArray(m)) return m as Meta;
  return {};
}

function num(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function ltpKpiMgmPct(raw: number): number {
  if (!Number.isFinite(raw) || raw < 0 || raw > 30) return 8;
  return raw;
}

function gmComputeStatus(row: { tenant: string; rent: number; deposit: number; mgmPct: number }): string {
  const tenant = typeof row.tenant === 'string' && row.tenant.trim().length > 0;
  const { rent, deposit, mgmPct: mgm } = row;
  if (mgm === 0 && deposit === 0 && rent === 0) return 'WTC';
  if (mgm === 10) return 'ADM';
  if (rent > 0 && !tenant) return 'INT';
  if (tenant) return 'ALG';
  return 'VG';
}

function gmGetEffectiveStatus(p: {
  statusOverride: string | null;
  tenant: string;
  rent: number;
  deposit: number;
  mgmPct: number;
}): string {
  if (p.statusOverride && ['ALG', 'VG', 'ADM', 'WTC', 'INT'].includes(p.statusOverride)) {
    return p.statusOverride;
  }
  return gmComputeStatus(p);
}

function computeDaysLate(lastPaymentDate: Date | null, now: Date): number {
  if (!lastPaymentDate) return 0;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  startOfMonth.setHours(0, 0, 0, 0);
  const last = new Date(lastPaymentDate);
  last.setHours(0, 0, 0, 0);
  const dayOfMonth = now.getDate();
  if (last < startOfMonth && dayOfMonth >= 5) {
    const diffMs = now.getTime() - lastPaymentDate.getTime();
    return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
  }
  return 0;
}

type PayPick = { paymentDate: Date; receiptAmount: Decimal; tenantId: string | null };

function pickLater(a: PayPick | null, b: PayPick | null): PayPick | null {
  if (!a) return b;
  if (!b) return a;
  return a.paymentDate >= b.paymentDate ? a : b;
}

function rowStatementStatus(meta: Meta): 'approved' | 'pending' | 'disputed' {
  const raw =
    (typeof meta.statementStatus === 'string' && meta.statementStatus) ||
    (typeof meta.ltStatementStatus === 'string' && meta.ltStatementStatus) ||
    '';
  const s = raw.trim().toLowerCase();
  if (s === 'pending') return 'pending';
  if (s === 'disputed') return 'disputed';
  return 'approved';
}

function asStatementOverride(meta: Meta): Meta | null {
  const raw = meta.statementOverride;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Meta;
}

export async function GET() {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const scopeUser = toClientScopeUser(user);
    const scope = getClientScopeWhere(scopeUser);

    const now = new Date();
    const curMonth = now.toISOString().slice(0, 7);

    const properties = await prisma.property.findMany({
      where: scope,
      orderBy: [{ code: 'asc' }],
      include: {
        owner: true,
        tenants: {
          where: { status: { in: ['active', 'notice'] } },
          orderBy: [{ name: 'asc' }],
        },
      },
    });

    const propertyIds = properties.map((p) => p.id);
    const tenantIds = [...new Set(properties.flatMap((p) => p.tenants.map((t) => t.id)))];

    const monthVals = monthRefQueryValues(curMonth);

    const expenses =
      propertyIds.length > 0
        ? await prisma.pmExpense.findMany({
            where: {
              ...(scope as Record<string, unknown>),
              monthRef: { in: monthVals },
              propertyId: { in: propertyIds },
            },
            select: { propertyId: true, ownerCharged: true },
          })
        : [];

    const expByProp = new Map<string, number>();
    for (const e of expenses) {
      if (!e.propertyId) continue;
      const add = Number(e.ownerCharged) || 0;
      expByProp.set(e.propertyId, (expByProp.get(e.propertyId) || 0) + add);
    }

    const paymentByTenant = new Map<string, PayPick>();
    if (tenantIds.length) {
      const tenantPayments = await prisma.tenantPayment.findMany({
        where: {
          tenantId: { in: tenantIds },
          cashAccount: { startsWith: '1150' },
        },
        orderBy: { paymentDate: 'desc' },
        select: { tenantId: true, paymentDate: true, receiptAmount: true },
      });
      for (const pay of tenantPayments) {
        if (!pay.tenantId) continue;
        if (!paymentByTenant.has(pay.tenantId)) {
          paymentByTenant.set(pay.tenantId, {
            paymentDate: pay.paymentDate,
            receiptAmount: pay.receiptAmount,
            tenantId: pay.tenantId,
          });
        }
      }
    }

    const paymentByProperty = new Map<string, PayPick>();
    if (propertyIds.length) {
      const propPayments = await prisma.tenantPayment.findMany({
        where: {
          propertyId: { in: propertyIds },
          cashAccount: { startsWith: '1150' },
        },
        orderBy: { paymentDate: 'desc' },
        select: { propertyId: true, tenantId: true, paymentDate: true, receiptAmount: true },
      });
      for (const pay of propPayments) {
        if (!pay.propertyId) continue;
        if (!paymentByProperty.has(pay.propertyId)) {
          paymentByProperty.set(pay.propertyId, {
            paymentDate: pay.paymentDate,
            receiptAmount: pay.receiptAmount,
            tenantId: pay.tenantId ?? null,
          });
        }
      }
    }

    const result = properties.map((p) => {
      const meta = asMeta(p.metadata);
      const ownerDisp = p.owner?.name ?? p.ownerName ?? '';
      const tenantMeta = typeof meta.tenant === 'string' ? meta.tenant : '';
      const tenantFromDb = p.tenants.map((t) => t.name).filter(Boolean).join(' & ');
      const tenantDisp = tenantFromDb || tenantMeta;

      const currentRent = num(p.rent);
      const marketRent = num(meta.marketRent);
      const rent = currentRent > 0 ? currentRent : marketRent;
      const deposit = num(p.deposit);
      const mgmPctRaw = num(p.mgmtFeePct);
      const mgmPctEff = ltpKpiMgmPct(mgmPctRaw);
      const garantidaNum =
        p.guaranteeLimit != null ? num(p.guaranteeLimit) : num(meta.guaranteeLimit);

      const occupancy =
        typeof meta.occupancy === 'string' && meta.occupancy
          ? String(meta.occupancy)
          : rent > 0
            ? 'rented'
            : 'vacant';

      const statusOverride =
        meta.statusOverride != null && typeof meta.statusOverride === 'string'
          ? meta.statusOverride
          : null;

      const statusAuto = gmGetEffectiveStatus({
        statusOverride,
        tenant: tenantDisp,
        rent,
        deposit,
        mgmPct: mgmPctRaw,
      });

      let tenantBest: PayPick | null = null;
      for (const t of p.tenants) {
        const pay = paymentByTenant.get(t.id);
        if (pay) tenantBest = pickLater(tenantBest, pay);
      }
      const propBest = paymentByProperty.get(p.id) ?? null;
      const best = pickLater(tenantBest, propBest);

      let lastPaymentDate: Date | null = best?.paymentDate ?? null;
      let lastPaymentAmount: number | null = best != null ? Number(best.receiptAmount) : null;
      let statusStmt: 'approved' | 'pending' | 'disputed' = rowStatementStatus(meta);

      const so = asStatementOverride(meta);
      if (so) {
        const oAmt = so.lastPaymentAmount;
        if (oAmt != null && Number.isFinite(Number(oAmt))) {
          lastPaymentAmount = Number(oAmt);
        }

        if (so.lastPaymentDate === null || so.lastPaymentDate === '') {
          lastPaymentDate = best?.paymentDate ?? null;
        } else if (typeof so.lastPaymentDate === 'string') {
          const d = new Date(so.lastPaymentDate);
          if (!Number.isNaN(d.getTime())) lastPaymentDate = d;
        }

        const ost = so.status;
        if (ost === 'approved' || ost === 'pending' || ost === 'disputed') {
          statusStmt = ost;
        }
      }

      const daysLate = computeDaysLate(lastPaymentDate, now);
      const tenantIdForPay = best?.tenantId ?? null;

      const expMes = expByProp.get(p.id) || 0;
      const netOwner = rent - (rent * mgmPctEff) / 100 - expMes;

      const mes = typeof meta.month === 'string' ? meta.month : '';

      return {
        id: p.id,
        code: p.code,
        address: p.address,
        owner: ownerDisp,
        tenant: tenantDisp || null,
        occupancy,
        statusAuto,
        rent,
        deposit,
        garantida: garantidaNum,
        mgmPct: mgmPctEff,
        netOwner,
        expMes,
        mes,
        status: statusStmt,
        lastPaymentAmount,
        lastPaymentDate: lastPaymentDate ? lastPaymentDate.toISOString() : null,
        daysLate,
        tenantId: tenantIdForPay,
      };
    });

    return NextResponse.json({ ok: true, properties: result });
  } catch (e) {
    console.error('[GET /api/owner-statement]', e);
    return NextResponse.json({ ok: false, error: 'Failed to load owner statement' }, { status: 500 });
  }
}
