import { NextResponse } from 'next/server';
import { Prisma, LeaseAgreementStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveAnalyticsClientId } from '@/lib/analyticsResolveClientId';
import { csrfGuard } from '@/lib/csrfGuard';
import { rateLimitGuard } from '@/lib/apiRateLimit';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

const dec = (v: unknown): Prisma.Decimal | null | undefined => {
  if (v === undefined) return undefined;
  if (v === '' || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? new Prisma.Decimal(n) : undefined;
};
const dt = (v: unknown): Date | null | undefined => {
  if (v === undefined) return undefined;
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d;
};

/** GET /api/lease-agreements/[id] — detalhe completo (inclui leaseForm). */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUserFromSession();
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const clientId = await resolveAnalyticsClientId(user, req);
    if (!clientId) return NextResponse.json({ ok: false, error: 'No client context' }, { status: 400 });

    const l = await prisma.leaseAgreement.findFirst({
      where: { id: String(params?.id || ''), clientId },
      include: {
        property: { select: { code: true, address: true, ownerName: true, ownerEmail: true } },
        tenant: { select: { name: true, email: true } },
      },
    });
    if (!l) return NextResponse.json({ ok: false, error: 'Contrato não encontrado.' }, { status: 404 });

    return NextResponse.json({
      ok: true,
      lease: {
        ...l,
        monthlyRent: String(l.monthlyRent),
        mgmtFeePct: String(l.mgmtFeePct),
        tenantPlacementPct: l.tenantPlacementPct != null ? String(l.tenantPlacementPct) : null,
        lateFeeFlat: String(l.lateFeeFlat),
        lateFeeDaily: String(l.lateFeeDaily),
        securityDeposit: String(l.securityDeposit),
        securityReserve: String(l.securityReserve),
        hoaValue: l.hoaValue != null ? String(l.hoaValue) : null,
        startDate: l.startDate?.toISOString() ?? null,
        endDate: l.endDate?.toISOString() ?? null,
        moveOutDate: l.moveOutDate?.toISOString() ?? null,
        attorneySentAt: l.attorneySentAt?.toISOString() ?? null,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    console.error('[lease-agreements/[id] GET]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Erro ao carregar contrato.' }, { status: 500 });
  }
}

/** PATCH /api/lease-agreements/[id] — edita campos, muda status, marca envio ao advogado. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const bad = csrfGuard(req);
  if (bad) return bad;
  const rl = rateLimitGuard(req, { bucket: 'lease-agreements', max: 60 });
  if (rl) return rl;
  try {
    const user = await getCurrentUserFromSession();
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const clientId = await resolveAnalyticsClientId(user, req);
    if (!clientId) return NextResponse.json({ ok: false, error: 'No client context' }, { status: 400 });

    const id = String(params?.id || '');
    const existing = await prisma.leaseAgreement.findFirst({ where: { id, clientId }, select: { id: true, leaseNumber: true } });
    if (!existing) return NextResponse.json({ ok: false, error: 'Contrato não encontrado.' }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const data: Prisma.LeaseAgreementUpdateInput = {};
    const set = <K extends keyof Prisma.LeaseAgreementUpdateInput>(k: K, v: Prisma.LeaseAgreementUpdateInput[K] | undefined) => {
      if (v !== undefined) data[k] = v;
    };

    if (typeof body.status === 'string' && (Object.values(LeaseAgreementStatus) as string[]).includes(body.status)) {
      set('status', body.status as LeaseAgreementStatus);
    }
    set('monthlyRent', dec(body.monthlyRent) ?? undefined);
    set('mgmtFeePct', dec(body.mgmtFeePct) ?? undefined);
    set('tenantPlacementPct', dec(body.tenantPlacementPct));
    set('lateFeeFlat', dec(body.lateFeeFlat) ?? undefined);
    set('lateFeeDaily', dec(body.lateFeeDaily) ?? undefined);
    set('securityDeposit', dec(body.securityDeposit) ?? undefined);
    set('securityReserve', dec(body.securityReserve) ?? undefined);
    set('hoaValue', dec(body.hoaValue));
    if (typeof body.hoaEnabled === 'boolean') set('hoaEnabled', body.hoaEnabled);
    if (typeof body.is1099 === 'boolean') set('is1099', body.is1099);
    set('startDate', dt(body.startDate));
    set('endDate', dt(body.endDate));
    set('moveOutDate', dt(body.moveOutDate));
    if (body.attorneySent === true) set('attorneySentAt', new Date());
    if (body.attorneySent === false) set('attorneySentAt', null);
    if (body.leaseForm !== undefined) set('leaseForm', (body.leaseForm ?? Prisma.JsonNull) as Prisma.InputJsonValue);
    if (typeof body.notes === 'string') set('notes', body.notes);
    if (body.qbInvoiceUrl !== undefined) set('qbInvoiceUrl', body.qbInvoiceUrl ? String(body.qbInvoiceUrl) : null);
    if (body.qbInvoiceId !== undefined) set('qbInvoiceId', body.qbInvoiceId ? String(body.qbInvoiceId) : null);

    if (!Object.keys(data).length) return NextResponse.json({ ok: false, error: 'Nada para atualizar.' }, { status: 400 });

    await prisma.leaseAgreement.update({ where: { id }, data });
    await recordAudit({
      request: req, actor: { id: user.id, email: user.email },
      action: 'lease_agreement.update', entity: 'lease_agreement', entityId: id, clientId,
      details: `Contrato #${existing.leaseNumber}: ${Object.keys(data).join(', ')}`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[lease-agreements/[id] PATCH]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Erro ao atualizar contrato.' }, { status: 500 });
  }
}
