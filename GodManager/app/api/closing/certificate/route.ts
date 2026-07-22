import { NextResponse } from 'next/server';
import { Prisma, BankAccountType, LeaseAgreementStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { csrfGuard } from '@/lib/csrfGuard';
import { rateLimitGuard } from '@/lib/apiRateLimit';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Monta o snapshot do fechamento do mês: recebimentos, pagamentos, depósito e saldos das contas. */
async function buildSnapshot(clientId: string, yearMonth: string) {
  const [y, m] = yearMonth.split('-').map(Number);
  const monthStart = new Date(Date.UTC(y, m - 1, 1));
  const monthEnd = new Date(Date.UTC(y, m, 1));

  const [received, paidAgg, deposits, balances, propsCount, paidCount] = await Promise.all([
    prisma.propertyGlTxn.aggregate({
      where: { clientId, kind: 'RECEIVED', txnDate: { gte: monthStart, lt: monthEnd } },
      _sum: { amount: true },
    }),
    prisma.ownerMonthPayout.aggregate({
      where: { yearMonth, property: { clientId } },
      _sum: { paidAmount: true },
    }),
    prisma.leaseAgreement.aggregate({
      where: { clientId, status: { not: LeaseAgreementStatus.TERMINATED } },
      _sum: { securityDeposit: true, securityReserve: true },
    }),
    prisma.bankAccountBalance.findMany({
      where: { clientId },
      orderBy: [{ balanceDate: 'desc' }, { recordedAt: 'desc' }],
      select: { accountType: true, balance: true, balanceDate: true },
    }),
    prisma.propertyGlTxn.findMany({
      where: { clientId, kind: 'RECEIVED', txnDate: { gte: monthStart, lt: monthEnd } },
      select: { propertyId: true, propertyLabel: true },
    }),
    prisma.ownerMonthPayout.count({ where: { yearMonth, property: { clientId }, paidAmount: { gt: 0 } } }),
  ]);

  const latest = new Map<BankAccountType, { balance: number; date: string }>();
  for (const b of balances) {
    if (!latest.has(b.accountType)) latest.set(b.accountType, { balance: Number(b.balance), date: b.balanceDate.toISOString().slice(0, 10) });
  }
  const housesReceived = new Set(propsCount.map((p) => p.propertyId || p.propertyLabel)).size;

  return {
    yearMonth,
    received: round2(Number(received._sum.amount ?? 0)),
    paid: round2(Number(paidAgg._sum.paidAmount ?? 0)),
    securityDeposit: round2(Number(deposits._sum.securityDeposit ?? 0)),
    securityReserve: round2(Number(deposits._sum.securityReserve ?? 0)),
    housesReceived,
    housesPaid: paidCount,
    operational: latest.get('OPERATING_TRUST') ?? null,
    trust: latest.get('TRUST_CHASE') ?? null,
    depositSecurityAccount: latest.get('DEPOSIT_SECURITY') ?? null,
    generatedAt: new Date().toISOString(),
  };
}

/** GET /api/closing/certificate?month=YYYY-MM — dados do fechamento + assinatura, se houver. */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  try {
    const url = new URL(req.url);
    const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
    if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
    const month = /^\d{4}-\d{2}$/.test(url.searchParams.get('month') || '') ? (url.searchParams.get('month') as string) : '';
    if (!month) return NextResponse.json({ ok: false, error: 'Informe o mês (YYYY-MM).' }, { status: 400 });

    const snapshot = await buildSnapshot(scope.clientId, month);
    const existing = await prisma.closingCertificate.findUnique({
      where: { clientId_yearMonth: { clientId: scope.clientId, yearMonth: month } },
      select: { signerName: true, signerRole: true, signedAt: true, snapshot: true },
    });
    return NextResponse.json({
      ok: true,
      snapshot,
      signed: existing?.signedAt
        ? { signerName: existing.signerName, signerRole: existing.signerRole, signedAt: existing.signedAt.toISOString(), snapshot: existing.snapshot }
        : null,
    });
  } catch (e) {
    console.error('[GET /api/closing/certificate]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Falha ao montar o termo de conferido.' }, { status: 500 });
  }
}

/** POST /api/closing/certificate { month, signerName } — Broker assina o termo (super_admin/admin/manager). */
export async function POST(req: Request) {
  const bad = csrfGuard(req);
  if (bad) return bad;
  const rl = rateLimitGuard(req, { bucket: 'closing-cert', max: 30 });
  if (rl) return rl;
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  const role = String(user.role || '').toLowerCase();
  if (!['super_admin', 'admin', 'manager'].includes(role)) {
    return NextResponse.json({ ok: false, error: 'Apenas o Broker/gestor pode assinar.' }, { status: 403 });
  }
  try {
    const body = (await req.json().catch(() => ({}))) as { month?: string; signerName?: string; clientId?: string };
    const scope = await resolveBankAccountClientScope(user, body.clientId || null);
    if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
    const month = /^\d{4}-\d{2}$/.test(body.month || '') ? (body.month as string) : '';
    if (!month) return NextResponse.json({ ok: false, error: 'Informe o mês (YYYY-MM).' }, { status: 400 });
    const signerName = String(body.signerName || '').trim() || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Broker';

    const snapshot = await buildSnapshot(scope.clientId, month);
    await prisma.closingCertificate.upsert({
      where: { clientId_yearMonth: { clientId: scope.clientId, yearMonth: month } },
      create: {
        clientId: scope.clientId, yearMonth: month, snapshot: snapshot as unknown as Prisma.InputJsonValue,
        signerName, signerRole: 'Broker', signedByUserId: user.id, signedAt: new Date(),
      },
      update: { snapshot: snapshot as unknown as Prisma.InputJsonValue, signerName, signerRole: 'Broker', signedByUserId: user.id, signedAt: new Date() },
    });
    await recordAudit({
      request: req, actor: { id: user.id, email: user.email },
      action: 'closing.certificate.sign', entity: 'closing_certificate', entityId: month, clientId: scope.clientId,
      details: `Termo de conferido ${month} assinado por ${signerName}`,
    });
    return NextResponse.json({ ok: true, signerName, signedAt: new Date().toISOString(), snapshot });
  } catch (e) {
    console.error('[POST /api/closing/certificate]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Falha ao assinar o termo.' }, { status: 500 });
  }
}
