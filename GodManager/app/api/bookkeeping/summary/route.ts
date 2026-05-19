import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUserFromSession } from "@/lib/authServer";
import { getClientScopeWhere, toClientScopeUser } from "@/lib/clientScope";

export const dynamic = "force-dynamic";

function decToNum(v: Prisma.Decimal | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

function pickRawNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : 0;
}

/** Parse YYYY-MM-DD as UTC; invalid returns null. */
function parseDateParam(s: string | null, endOfDay: boolean): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s.trim())) return null;
  const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  if (endOfDay) {
    return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
  }
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

function defaultMonthRangeUTC(now = new Date()): { from: Date; to: Date } {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { from, to };
}

function ytdStartUTC(to: Date): Date {
  return new Date(Date.UTC(to.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
}

type SumCount = { value: number; count: number };

async function revenueForWhere(
  base: Prisma.TenantPaymentWhereInput,
  from: Date,
  to: Date,
): Promise<SumCount> {
  const where: Prisma.TenantPaymentWhereInput = {
    ...base,
    paymentDate: { gte: from, lte: to },
  };
  const [agg, count] = await Promise.all([
    prisma.tenantPayment.aggregate({
      where,
      _sum: { receiptAmount: true },
    }),
    prisma.tenantPayment.count({ where }),
  ]);
  return { value: decToNum(agg._sum.receiptAmount), count };
}

async function pmSumsForWhere(
  base: Prisma.PmExpenseWhereInput,
  from: Date,
  to: Date,
): Promise<{ vendorCost: SumCount; ownerCharged: SumCount }> {
  const where: Prisma.PmExpenseWhereInput = {
    ...base,
    serviceDate: { gte: from, lte: to },
  };
  const [agg, count] = await Promise.all([
    prisma.pmExpense.aggregate({
      where,
      _sum: { vendorCost: true, ownerCharged: true },
    }),
    prisma.pmExpense.count({ where }),
  ]);
  const v = decToNum(agg._sum.vendorCost);
  const o = decToNum(agg._sum.ownerCharged);
  return {
    vendorCost: { value: v, count },
    ownerCharged: { value: o, count },
  };
}

export async function GET(req: Request) {
  let userId: string | undefined;
  try {
    const user = await getCurrentUserFromSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = user.id;

    const roleNorm = String(user.role || "").toLowerCase();
    if (roleNorm === "maintenance") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const scopeUser = toClientScopeUser(user);
    const scopeWhere = getClientScopeWhere(scopeUser);

    const url = new URL(req.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    let from =
      parseDateParam(fromParam, false) ??
      defaultMonthRangeUTC(new Date()).from;
    let to =
      parseDateParam(toParam, true) ??
      defaultMonthRangeUTC(new Date()).to;

    if (from.getTime() > to.getTime()) {
      const t = from;
      from = to;
      to = t;
      to.setUTCHours(23, 59, 59, 999);
    }

    const ytdFrom = ytdStartUTC(to);

    type ARBucketRow = {
      current: unknown;
      bucket_30_60: unknown;
      bucket_60_90: unknown;
      over_90: unknown;
      total: unknown;
      qtd: bigint | number | unknown;
    };

    const scopeSqlPending =
      scopeUser.role === "super_admin"
        ? Prisma.sql`TRUE`
        : scopeUser.clientId
          ? Prisma.sql`"clientId" = ${scopeUser.clientId}`
          : Prisma.sql`FALSE`;

    const [
      revenueMonth,
      revenueYtd,
      pmMonth,
      pmYtd,
      pendingRaw,
      topVendorGroups,
      topPropertyGroups,
    ] = await Promise.all([
      revenueForWhere(scopeWhere as Prisma.TenantPaymentWhereInput, from, to),
      revenueForWhere(scopeWhere as Prisma.TenantPaymentWhereInput, ytdFrom, to),
      pmSumsForWhere(scopeWhere as Prisma.PmExpenseWhereInput, from, to),
      pmSumsForWhere(scopeWhere as Prisma.PmExpenseWhereInput, ytdFrom, to),
      prisma.$queryRaw<ARBucketRow[]>(Prisma.sql`
        SELECT
          COALESCE(SUM(CASE WHEN "serviceDate" IS NOT NULL AND now() - "serviceDate" <= interval '30 days' THEN "ownerCharged" END), 0) AS "current",
          COALESCE(SUM(CASE WHEN "serviceDate" IS NOT NULL AND now() - "serviceDate" > interval '30 days' AND now() - "serviceDate" <= interval '60 days' THEN "ownerCharged" END), 0) AS "bucket_30_60",
          COALESCE(SUM(CASE WHEN "serviceDate" IS NOT NULL AND now() - "serviceDate" > interval '60 days' AND now() - "serviceDate" <= interval '90 days' THEN "ownerCharged" END), 0) AS "bucket_60_90",
          COALESCE(SUM(CASE WHEN "serviceDate" IS NOT NULL AND now() - "serviceDate" > interval '90 days' THEN "ownerCharged" END), 0) AS "over_90",
          COALESCE(SUM("ownerCharged"), 0) AS "total",
          COUNT(*) AS "qtd"
        FROM pm_expenses
        WHERE status = 'PENDING'
          AND (${scopeSqlPending})
      `),
      prisma.pmExpense.groupBy({
        by: ["vendorId"],
        where: {
          ...(scopeWhere as Prisma.PmExpenseWhereInput),
          serviceDate: { gte: from, lte: to },
          vendorId: { not: null },
        },
        _sum: { vendorCost: true },
        _count: { _all: true },
        orderBy: { _sum: { vendorCost: "desc" } },
        take: 5,
      }),
      prisma.pmExpense.groupBy({
        by: ["propertyId"],
        where: {
          ...(scopeWhere as Prisma.PmExpenseWhereInput),
          serviceDate: { gte: from, lte: to },
        },
        _sum: { ownerCharged: true },
        _count: { _all: true },
        orderBy: { _sum: { ownerCharged: "desc" } },
        take: 5,
      }),
    ]);

    const p0 = pendingRaw[0];
    const pendingAR = {
      current: p0 ? pickRawNum(p0.current) : 0,
      bucket_30_60: p0 ? pickRawNum(p0.bucket_30_60) : 0,
      bucket_60_90: p0 ? pickRawNum(p0.bucket_60_90) : 0,
      over_90: p0 ? pickRawNum(p0.over_90) : 0,
      total: p0 ? pickRawNum(p0.total) : 0,
      count: p0 ? pickRawNum(p0.qtd) : 0,
    };

    const vendorIds = topVendorGroups
      .map((g) => g.vendorId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    const vendors =
      vendorIds.length > 0
        ? await prisma.pmVendor.findMany({
            where: {
              id: { in: vendorIds },
              ...(scopeWhere as Prisma.PmVendorWhereInput),
            },
            select: { id: true, companyName: true },
          })
        : [];
    const vendorNameById = new Map(vendors.map((v) => [v.id, v.companyName || ""]));

    const topVendors = topVendorGroups.map((g) => ({
      id: g.vendorId as string,
      name: vendorNameById.get(g.vendorId as string) || "",
      total: decToNum(g._sum.vendorCost),
      count: g._count._all,
    }));

    const propertyIds = topPropertyGroups.map((g) => g.propertyId);
    const propertiesRows =
      propertyIds.length > 0
        ? await prisma.property.findMany({
            where: {
              id: { in: propertyIds },
              ...(scopeWhere as Prisma.PropertyWhereInput),
            },
            select: { id: true, address: true },
          })
        : [];
    const addrById = new Map(propertiesRows.map((p) => [p.id, p.address || ""]));

    const topProperties = topPropertyGroups.map((g) => ({
      id: g.propertyId,
      address: addrById.get(g.propertyId) || "",
      total: decToNum(g._sum.ownerCharged),
      count: g._count._all,
    }));

    const monthMarkup = pmMonth.ownerCharged.value - pmMonth.vendorCost.value;
    const ytdMarkup = pmYtd.ownerCharged.value - pmYtd.vendorCost.value;
    const marginPct =
      pmMonth.ownerCharged.value > 0 ? monthMarkup / pmMonth.ownerCharged.value : 0;

    return NextResponse.json({
      period: {
        from: from.toISOString(),
        to: to.toISOString(),
        ytdFrom: ytdFrom.toISOString(),
      },
      revenue: {
        month: revenueMonth,
        ytd: revenueYtd,
      },
      vendorCost: {
        month: pmMonth.vendorCost,
        ytd: pmYtd.vendorCost,
      },
      ownerCharged: {
        month: pmMonth.ownerCharged,
        ytd: pmYtd.ownerCharged,
      },
      markup: {
        month: monthMarkup,
        ytd: ytdMarkup,
        marginPct,
      },
      pendingAR,
      topVendors,
      topProperties,
    });
  } catch (e: unknown) {
    console.error("[GET /api/bookkeeping/summary]", userId ?? "?", e);
    const msg =
      e instanceof Error ? e.message : typeof e === "string" ? e : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
