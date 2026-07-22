import { NextResponse } from 'next/server';
import { Prisma, LeaseAgreementStatus, LeaseRentPeriod } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveAnalyticsClientId } from '@/lib/analyticsResolveClientId';
import { csrfGuard } from '@/lib/csrfGuard';
import { rateLimitGuard } from '@/lib/apiRateLimit';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

const RENT_PERIODS = new Set(Object.values(LeaseRentPeriod));
const dec = (v: unknown, def: number | null = null): Prisma.Decimal | null => {
  if (v === '' || v === null || v === undefined) return def === null ? null : new Prisma.Decimal(def);
  const n = Number(v);
  return Number.isFinite(n) ? new Prisma.Decimal(n) : def === null ? null : new Prisma.Decimal(def);
};
const dt = (v: unknown): Date | null => {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};

/** GET /api/lease-agreements — lista os contratos autorados (modelo FL), escopado por cliente. */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUserFromSession();
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const clientId = await resolveAnalyticsClientId(user, req);
    if (!clientId) return NextResponse.json({ ok: false, error: 'No client context' }, { status: 400 });

    const url = new URL(req.url);
    const statusParam = url.searchParams.get('status') || '';
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();

    const where: Prisma.LeaseAgreementWhereInput = { clientId };
    if (statusParam && (Object.values(LeaseAgreementStatus) as string[]).includes(statusParam)) {
      where.status = statusParam as LeaseAgreementStatus;
    }

    const rows = await prisma.leaseAgreement.findMany({
      where,
      orderBy: [{ leaseNumber: 'desc' }],
      take: 500,
      include: {
        property: { select: { code: true, address: true, ownerName: true } },
        tenant: { select: { name: true } },
      },
    });

    const leases = rows
      .map((l) => ({
        id: l.id,
        leaseNumber: l.leaseNumber,
        contractCode: l.contractCode || '',
        status: l.status,
        isRenewal: l.isRenewal,
        propertyId: l.propertyId,
        propertyCode: l.property?.code || '',
        propertyAddress: l.property?.address || '',
        owner: l.property?.ownerName || '',
        tenantId: l.tenantId,
        tenantName: l.tenant?.name || '',
        monthlyRent: String(l.monthlyRent),
        rentPeriod: l.rentPeriod,
        mgmtFeePct: String(l.mgmtFeePct),
        tenantPlacementPct: l.tenantPlacementPct != null ? String(l.tenantPlacementPct) : null,
        securityDeposit: String(l.securityDeposit),
        securityReserve: String(l.securityReserve),
        hoaEnabled: l.hoaEnabled,
        hoaValue: l.hoaValue != null ? String(l.hoaValue) : null,
        is1099: l.is1099,
        startDate: l.startDate?.toISOString() ?? null,
        endDate: l.endDate?.toISOString() ?? null,
        moveOutDate: l.moveOutDate?.toISOString() ?? null,
        attorneySentAt: l.attorneySentAt?.toISOString() ?? null,
        qbInvoiceUrl: l.qbInvoiceUrl,
      }))
      .filter((l) => {
        if (!q) return true;
        return [String(l.leaseNumber), l.contractCode, l.propertyAddress, l.propertyCode, l.owner, l.tenantName]
          .join(' ')
          .toLowerCase()
          .includes(q);
      });

    return NextResponse.json({ ok: true, clientId, leases });
  } catch (e) {
    console.error('[lease-agreements GET]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Erro ao listar contratos.' }, { status: 500 });
  }
}

/** POST /api/lease-agreements — cria contrato (nº sequencial único por cliente, vinculado ao imóvel). */
export async function POST(req: Request) {
  const bad = csrfGuard(req);
  if (bad) return bad;
  const rl = rateLimitGuard(req, { bucket: 'lease-agreements', max: 30 });
  if (rl) return rl;
  try {
    const user = await getCurrentUserFromSession();
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const clientId = await resolveAnalyticsClientId(user, req);
    if (!clientId) return NextResponse.json({ ok: false, error: 'No client context' }, { status: 400 });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const propertyId = String(body.propertyId || '').trim();
    if (!propertyId) return NextResponse.json({ ok: false, error: 'Imóvel é obrigatório.' }, { status: 400 });

    const prop = await prisma.property.findFirst({ where: { id: propertyId, clientId }, select: { id: true, code: true, address: true } });
    if (!prop) return NextResponse.json({ ok: false, error: 'Imóvel não encontrado neste cliente.' }, { status: 404 });

    // Código do contrato: CTGD + AAAAMMDD + código da casa + 2 primeiras letras do endereço.
    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const firstWord = String(prop.address || '').replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/)[0] || '';
    const twoLetters = firstWord.slice(0, 2).toUpperCase();
    const contractCode = `CTGD${ymd}${String(prop.code || '').toUpperCase()}${twoLetters}`;

    const tenantId = String(body.tenantId || '').trim() || null;
    if (tenantId) {
      const t = await prisma.tenant.findFirst({ where: { id: tenantId, clientId }, select: { id: true } });
      if (!t) return NextResponse.json({ ok: false, error: 'Locatário não encontrado neste cliente.' }, { status: 404 });
    }

    const rentPeriod = RENT_PERIODS.has(body.rentPeriod as LeaseRentPeriod)
      ? (body.rentPeriod as LeaseRentPeriod)
      : LeaseRentPeriod.MONTHLY;

    const created = await prisma.$transaction(async (tx) => {
      const last = await tx.leaseAgreement.findFirst({
        where: { clientId },
        orderBy: { leaseNumber: 'desc' },
        select: { leaseNumber: true },
      });
      const leaseNumber = (last?.leaseNumber ?? 0) + 1;
      return tx.leaseAgreement.create({
        data: {
          clientId,
          leaseNumber,
          contractCode,
          propertyId,
          tenantId,
          isRenewal: body.isRenewal === true,
          monthlyRent: dec(body.monthlyRent, 0)!,
          rentPeriod,
          mgmtFeePct: dec(body.mgmtFeePct, 8)!,
          tenantPlacementPct: dec(body.tenantPlacementPct),
          lateFeeFlat: dec(body.lateFeeFlat, 150)!,
          lateFeeDaily: dec(body.lateFeeDaily, 5)!,
          securityDeposit: dec(body.securityDeposit, 0)!,
          securityReserve: dec(body.securityReserve, 0)!,
          is1099: body.is1099 === true,
          guaranteeType: String(body.guaranteeType || 'SECURITY_DEPOSIT'),
          hoaEnabled: body.hoaEnabled === true,
          hoaValue: dec(body.hoaValue),
          startDate: dt(body.startDate),
          endDate: dt(body.endDate),
          durationMonths: Number.isFinite(Number(body.durationMonths)) ? Number(body.durationMonths) : null,
          leaseForm: (body.leaseForm ?? undefined) as Prisma.InputJsonValue | undefined,
          notes: body.notes ? String(body.notes) : null,
          createdByUserId: user.id,
        },
        select: { id: true, leaseNumber: true },
      });
    });

    await recordAudit({
      request: req, actor: { id: user.id, email: user.email },
      action: 'lease_agreement.create', entity: 'lease_agreement', entityId: created.id, clientId,
      details: `Contrato #${created.leaseNumber} · imóvel ${propertyId}`,
    });

    return NextResponse.json({ ok: true, id: created.id, leaseNumber: created.leaseNumber, contractCode });
  } catch (e) {
    console.error('[lease-agreements POST]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Erro ao criar contrato.' }, { status: 500 });
  }
}
