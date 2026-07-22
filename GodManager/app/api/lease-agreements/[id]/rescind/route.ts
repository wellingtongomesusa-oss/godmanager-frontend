import { NextResponse } from 'next/server';
import { Prisma, LeaseAgreementStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveAnalyticsClientId } from '@/lib/analyticsResolveClientId';
import { csrfGuard } from '@/lib/csrfGuard';
import { rateLimitGuard } from '@/lib/apiRateLimit';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

const round2 = (n: number) => Math.round(n * 100) / 100;

async function scope(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return { err: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) };
  const clientId = await resolveAnalyticsClientId(user, req);
  if (!clientId) return { err: NextResponse.json({ ok: false, error: 'No client context' }, { status: 400 }) };
  return { user, clientId };
}

/** GET — resumo da rescisão: depósito, reserva, deduções e saldo do depósito. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const s = await scope(req);
  if ('err' in s) return s.err;
  const id = String(params?.id || '');
  const lease = await prisma.leaseAgreement.findFirst({
    where: { id, clientId: s.clientId },
    select: { id: true, leaseNumber: true, status: true, securityDeposit: true, securityReserve: true, moveOutDate: true },
  });
  if (!lease) return NextResponse.json({ ok: false, error: 'Contrato não encontrado.' }, { status: 404 });
  const deductions = await prisma.leaseDepositDeduction.findMany({
    where: { clientId: s.clientId, leaseId: id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, description: true, amount: true, createdAt: true },
  });
  const deposit = Number(lease.securityDeposit);
  const totalDeducted = round2(deductions.reduce((sum, d) => sum + Number(d.amount), 0));
  return NextResponse.json({
    ok: true,
    leaseNumber: lease.leaseNumber,
    status: lease.status,
    moveOutDate: lease.moveOutDate?.toISOString() ?? null,
    securityDeposit: round2(deposit),
    securityReserve: round2(Number(lease.securityReserve)),
    totalDeducted,
    depositBalance: round2(deposit - totalDeducted),
    deductions: deductions.map((d) => ({ id: d.id, description: d.description, amount: round2(Number(d.amount)), createdAt: d.createdAt.toISOString() })),
  });
}

/**
 * POST — ações da rescisão:
 *  { action: 'add', description, amount }   → adiciona dedução (abate do depósito)
 *  { action: 'remove', deductionId }        → remove dedução
 *  { action: 'confirm', moveOutDate }       → rescinde: status TERMINATED + move-out + auditoria
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const bad = csrfGuard(req);
  if (bad) return bad;
  const rl = rateLimitGuard(req, { bucket: 'lease-rescind', max: 60 });
  if (rl) return rl;
  const s = await scope(req);
  if ('err' in s) return s.err;
  const id = String(params?.id || '');
  const lease = await prisma.leaseAgreement.findFirst({ where: { id, clientId: s.clientId }, select: { id: true, leaseNumber: true } });
  if (!lease) return NextResponse.json({ ok: false, error: 'Contrato não encontrado.' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || '');

  try {
    if (action === 'add') {
      const description = String(body.description || '').trim().slice(0, 300);
      const amount = Number(body.amount);
      if (!description || !Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ ok: false, error: 'Descrição e valor (>0) são obrigatórios.' }, { status: 400 });
      }
      await prisma.leaseDepositDeduction.create({
        data: { clientId: s.clientId, leaseId: id, description, amount: new Prisma.Decimal(amount), createdByUserId: s.user.id },
      });
      return NextResponse.json({ ok: true });
    }
    if (action === 'remove') {
      const deductionId = String(body.deductionId || '');
      await prisma.leaseDepositDeduction.deleteMany({ where: { id: deductionId, clientId: s.clientId, leaseId: id } });
      return NextResponse.json({ ok: true });
    }
    if (action === 'confirm') {
      const moveOut = body.moveOutDate ? new Date(String(body.moveOutDate)) : new Date();
      if (Number.isNaN(moveOut.getTime())) return NextResponse.json({ ok: false, error: 'Data de move-out inválida.' }, { status: 400 });
      await prisma.leaseAgreement.update({
        where: { id },
        data: { status: LeaseAgreementStatus.TERMINATED, moveOutDate: moveOut },
      });
      await recordAudit({
        request: req, actor: { id: s.user.id, email: s.user.email },
        action: 'lease_agreement.rescind', entity: 'lease_agreement', entityId: id, clientId: s.clientId,
        details: `Contrato #${lease.leaseNumber} rescindido · move-out ${moveOut.toISOString().slice(0, 10)}`,
      });
      return NextResponse.json({ ok: true, moveOutDate: moveOut.toISOString() });
    }
    return NextResponse.json({ ok: false, error: 'Ação inválida.' }, { status: 400 });
  } catch (e) {
    console.error('[lease rescind POST]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Erro na rescisão.' }, { status: 500 });
  }
}
