import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/requireSuperAdmin';
import { recomputeOwnerMonthPayoutTotals } from '@/lib/ownerStatementTotals';
import { normalizeYearMonthForWrite } from '@/lib/pmMonthRef';
import { recordAudit } from '@/lib/auditServer';
import { qbCreatePurchase, qbFindOrCreateVendor } from '@/lib/quickbooksPost';

export const dynamic = 'force-dynamic';

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function truncDesc(s: string): string {
  const t = s.trim();
  return t.length > 300 ? t.slice(0, 300) : t;
}

/**
 * GET /api/ramp/post?clientId=&ids=a,b,c
 * Devolve os rampTransactionId já lançados (p/ a UI marcar "✓ Lançado").
 */
export async function GET(req: Request) {
  const gate = await requireSuperAdmin();
  if (gate.error) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  const url = new URL(req.url);
  const clientId = (url.searchParams.get('clientId') || '').trim();
  if (!clientId) return NextResponse.json({ ok: true, postings: {} });
  const idsParam = (url.searchParams.get('ids') || '').trim();
  const ids = idsParam ? idsParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 500) : [];
  const where: Prisma.RampExpensePostingWhereInput = { clientId };
  if (ids.length) where.rampTransactionId = { in: ids };
  const rows = await prisma.rampExpensePosting.findMany({
    where,
    select: { rampTransactionId: true, target: true, propertyId: true, yearMonth: true, amount: true, qbEntityType: true, qbEntityId: true },
  });
  const postings: Record<string, { target: string; propertyId: string | null; yearMonth: string | null; amount: string; qb: boolean }> = {};
  for (const r of rows) {
    postings[r.rampTransactionId] = {
      target: r.target,
      propertyId: r.propertyId,
      yearMonth: r.yearMonth,
      amount: r.amount.toFixed(2),
      qb: !!r.qbEntityId,
    };
  }
  return NextResponse.json({ ok: true, postings });
}

/**
 * POST /api/ramp/post
 *   { rampTransactionId, target:'STATEMENT'|'MANAGER_PROP', clientId,
 *     propertyId?, yearMonth?, amount, merchant?, description?, transactionDate? }
 * STATEMENT   → cria StatementLineItem (expense) PENDENTE de aprovação na casa/mês.
 * MANAGER_PROP→ registra a despesa como custo da Manager Prop (sem casa).
 * Idempotente: rampTransactionId já lançado retorna 409.
 */
export async function POST(req: Request) {
  const gate = await requireSuperAdmin();
  if (gate.error || !gate.user) {
    return NextResponse.json({ ok: false, error: gate.error || 'Não autenticado.' }, { status: gate.status });
  }
  const user = gate.user;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const rampTransactionId = String(body?.rampTransactionId || '').trim();
    const target = String(body?.target || '').trim().toUpperCase();
    let clientId = String(body?.clientId || '').trim();
    const propertyId = String(body?.propertyId || '').trim();
    const merchant = body?.merchant != null ? String(body.merchant).trim().slice(0, 200) : null;
    const descIn = body?.description != null ? String(body.description) : '';
    const amountNum = Number(body?.amount);

    if (!rampTransactionId) {
      return NextResponse.json({ ok: false, error: 'rampTransactionId obrigatório.' }, { status: 400 });
    }
    if (target !== 'STATEMENT' && target !== 'MANAGER_PROP') {
      return NextResponse.json({ ok: false, error: 'target inválido (STATEMENT | MANAGER_PROP).' }, { status: 400 });
    }
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return NextResponse.json({ ok: false, error: 'amount deve ser positivo.' }, { status: 400 });
    }

    let transactionDate: Date | null = null;
    if (body?.transactionDate != null && body.transactionDate !== '') {
      const d = new Date(String(body.transactionDate));
      if (!Number.isNaN(d.getTime())) transactionDate = d;
    }

    // Descrição base: "Ramp · <merchant>" (o merchant deixa claro a origem no statement).
    const baseDesc = truncDesc(descIn.trim() || (merchant ? `Ramp · ${merchant}` : `Ramp · ${rampTransactionId}`));

    if (target === 'STATEMENT') {
      if (!propertyId) {
        return NextResponse.json({ ok: false, error: 'propertyId obrigatório para STATEMENT.' }, { status: 400 });
      }
      const yearMonthNorm = normalizeYearMonthForWrite(String(body?.yearMonth || ''));
      if (!yearMonthNorm || !YEAR_MONTH.test(yearMonthNorm)) {
        return NextResponse.json({ ok: false, error: 'yearMonth inválido (YYYY-MM).' }, { status: 400 });
      }
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { id: true, clientId: true },
      });
      if (!property) return NextResponse.json({ ok: false, error: 'Propriedade não encontrada.' }, { status: 404 });
      clientId = property.clientId || clientId;
      if (!clientId) return NextResponse.json({ ok: false, error: 'Cliente não resolvido.' }, { status: 400 });

      const dup = await prisma.rampExpensePosting.findUnique({
        where: { clientId_rampTransactionId: { clientId, rampTransactionId } },
        select: { id: true, target: true },
      });
      if (dup) return NextResponse.json({ ok: false, error: 'Transação já lançada.', already: dup.target }, { status: 409 });

      const result = await prisma.$transaction(async (tx) => {
        const payout = await tx.ownerMonthPayout.upsert({
          where: { propertyId_yearMonth: { propertyId, yearMonth: yearMonthNorm } },
          create: {
            propertyId,
            yearMonth: yearMonthNorm,
            clientId,
            totalIncome: new Prisma.Decimal(0),
            totalExpenses: new Prisma.Decimal(0),
            netPayout: new Prisma.Decimal(0),
          },
          update: { clientId },
        });
        const li = await tx.statementLineItem.create({
          data: {
            ownerMonthPayoutId: payout.id,
            lineType: 'expense',
            description: baseDesc,
            amount: amountNum,
            sortOrder: transactionDate ? transactionDate.getUTCDate() * 10 + 6 : 6,
            clientId,
            source: 'MANUAL',
            sourceRefId: rampTransactionId,
            transactionDate: transactionDate ?? new Date(),
            // approvedAt fica NULL → entra como "aguardando aprovação" (workflow #10).
          },
          select: { id: true },
        });
        await recomputeOwnerMonthPayoutTotals(payout.id, tx);
        const posting = await tx.rampExpensePosting.create({
          data: {
            clientId,
            rampTransactionId,
            target: 'STATEMENT',
            propertyId,
            yearMonth: yearMonthNorm,
            amount: amountNum,
            merchant,
            description: baseDesc,
            transactionDate,
            statementLineItemId: li.id,
            matchedExpenseId: body?.matchedExpenseId ? String(body.matchedExpenseId).slice(0, 40) : null,
            postedById: user.id,
            postedByEmail: user.email ?? null,
          },
          select: { id: true },
        });
        return { lineItemId: li.id, postingId: posting.id, payoutId: payout.id };
      });

      await recordAudit({
        request: req,
        actor: { id: user.id, email: user.email },
        action: 'ramp.post.statement',
        entity: 'ramp_expense_posting',
        entityId: result.postingId,
        clientId,
        details: `prop:${propertyId} ym:${yearMonthNorm} amt:${amountNum.toFixed(2)} tx:${rampTransactionId}`,
      });
      return NextResponse.json({ ok: true, target: 'STATEMENT', ...result });
    }

    // target === 'MANAGER_PROP'
    if (!clientId) {
      return NextResponse.json({ ok: false, error: 'clientId obrigatório para MANAGER_PROP.' }, { status: 400 });
    }
    const dup = await prisma.rampExpensePosting.findUnique({
      where: { clientId_rampTransactionId: { clientId, rampTransactionId } },
      select: { id: true, target: true },
    });
    if (dup) return NextResponse.json({ ok: false, error: 'Transação já lançada.', already: dup.target }, { status: 409 });

    const posting = await prisma.rampExpensePosting.create({
      data: {
        clientId,
        rampTransactionId,
        target: 'MANAGER_PROP',
        propertyId: null,
        yearMonth: null,
        amount: amountNum,
        merchant,
        description: baseDesc,
        transactionDate,
        postedById: user.id,
        postedByEmail: user.email ?? null,
      },
      select: { id: true },
    });

    // Opcional: empurrar como Purchase no QuickBooks (débito despesa / crédito cartão-banco).
    let qb: { ok: boolean; id?: string; docNumber?: string | null; error?: string } | null = null;
    if (body?.qbPost) {
      const qbExpenseAccountId = String(body?.qbExpenseAccountId || '').trim();
      const qbPaymentAccountId = String(body?.qbPaymentAccountId || '').trim();
      if (!qbExpenseAccountId || !qbPaymentAccountId) {
        qb = { ok: false, error: 'Informe as contas do QuickBooks (despesa e pagamento).' };
      } else {
        try {
          const vendorId = merchant ? await qbFindOrCreateVendor(clientId, merchant) : null;
          const purchase = await qbCreatePurchase(clientId, {
            amount: amountNum,
            expenseAccountId: qbExpenseAccountId,
            paymentAccountId: qbPaymentAccountId,
            paymentType: 'CreditCard',
            vendorId,
            txnDate: transactionDate ? transactionDate.toISOString().slice(0, 10) : null,
            memo: baseDesc,
            description: baseDesc,
          });
          await prisma.rampExpensePosting.update({
            where: { id: posting.id },
            data: { qbEntityType: 'Purchase', qbEntityId: purchase.id },
          });
          qb = { ok: true, id: purchase.id, docNumber: purchase.docNumber };
        } catch (e) {
          qb = { ok: false, error: e instanceof Error ? e.message : 'Falha ao lançar no QuickBooks.' };
        }
      }
    }

    await recordAudit({
      request: req,
      actor: { id: user.id, email: user.email },
      action: 'ramp.post.manager_prop',
      entity: 'ramp_expense_posting',
      entityId: posting.id,
      clientId,
      details: `amt:${amountNum.toFixed(2)} tx:${rampTransactionId} merchant:${merchant ?? ''}${qb?.ok ? ' qb:' + qb.id : ''}`,
    });
    return NextResponse.json({ ok: true, target: 'MANAGER_PROP', postingId: posting.id, qb });
  } catch (e) {
    console.error('[POST /api/ramp/post]', e);
    return NextResponse.json({ ok: false, error: 'Erro ao lançar transação do Ramp.' }, { status: 500 });
  }
}
