import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const ACCOUNT_KEYS = ['TRUST_CHASE', 'OPERATING_TRUST', 'DEPOSIT_SECURITY'];

function num(d: Prisma.Decimal | number | null | undefined): number {
  if (d == null) return 0;
  return typeof d === 'number' ? d : Number(d);
}

type ItemRow = {
  id: string;
  description: string;
  amount: Prisma.Decimal;
  txnDate: Date | null;
  sourceType: string;
  sourceRefId: string | null;
  cleared: boolean;
  category?: string | null;
};

function serialize(rec: {
  id: string;
  bankAccountKey: string;
  periodMonth: string;
  openingBalance: Prisma.Decimal;
  statementBalance: Prisma.Decimal;
  status: string;
  notes: string | null;
  reconciledAt: Date | null;
  items: ItemRow[];
}) {
  const opening = num(rec.openingBalance);
  const statement = num(rec.statementBalance);
  const cleared = rec.items.filter((i) => i.cleared);
  // Extrato de conciliação: separa entradas (crédito, +) e saídas (débito, -)
  const clearedDeposits = cleared.filter((i) => num(i.amount) >= 0).reduce((s, i) => s + num(i.amount), 0);
  const clearedPayments = cleared.filter((i) => num(i.amount) < 0).reduce((s, i) => s + Math.abs(num(i.amount)), 0);
  const clearedTotal = clearedDeposits - clearedPayments;
  const bookBalance = opening + clearedTotal;
  const difference = Math.round((statement - bookBalance) * 100) / 100;
  const round2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
  // Não-conciliados (ainda não marcados como cleared) — pendências
  const uncleared = rec.items.filter((i) => !i.cleared);
  const unclearedDeposits = uncleared.filter((i) => num(i.amount) >= 0).reduce((s, i) => s + num(i.amount), 0);
  const unclearedPayments = uncleared.filter((i) => num(i.amount) < 0).reduce((s, i) => s + Math.abs(num(i.amount)), 0);
  return {
    id: rec.id,
    bankAccountKey: rec.bankAccountKey,
    periodMonth: rec.periodMonth,
    openingBalance: opening.toFixed(2),
    statementBalance: statement.toFixed(2),
    status: rec.status,
    notes: rec.notes,
    reconciledAt: rec.reconciledAt ? rec.reconciledAt.toISOString() : null,
    clearedDeposits: round2(clearedDeposits),
    clearedPayments: round2(clearedPayments),
    clearedTotal: round2(clearedTotal),
    unclearedDeposits: round2(unclearedDeposits),
    unclearedPayments: round2(unclearedPayments),
    unclearedCount: uncleared.length,
    bookBalance: round2(bookBalance),
    difference: difference.toFixed(2),
    balanced: Math.abs(difference) < 0.005,
    items: rec.items.map((i) => ({
      id: i.id,
      description: i.description,
      amount: num(i.amount).toFixed(2),
      txnDate: i.txnDate ? i.txnDate.toISOString().slice(0, 10) : null,
      sourceType: i.sourceType,
      sourceRefId: i.sourceRefId,
      cleared: i.cleared,
      category: i.category ?? null,
    })),
  };
}

/** GET /api/reconciliation?clientId=&bankAccountKey=&periodMonth= → conciliação (ou null). */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  const url = new URL(req.url);
  const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

  const bankAccountKey = (url.searchParams.get('bankAccountKey') || '').trim().toUpperCase();
  const periodMonth = (url.searchParams.get('periodMonth') || '').trim();
  if (!ACCOUNT_KEYS.includes(bankAccountKey)) return NextResponse.json({ ok: false, error: 'bankAccountKey inválido.' }, { status: 400 });
  if (!YEAR_MONTH.test(periodMonth)) return NextResponse.json({ ok: false, error: 'periodMonth inválido (YYYY-MM).' }, { status: 400 });

  const rec = await prisma.bankReconciliation.findUnique({
    where: { clientId_bankAccountKey_periodMonth: { clientId: scope.clientId, bankAccountKey, periodMonth } },
    include: { items: { orderBy: [{ txnDate: 'asc' }, { createdAt: 'asc' }] } },
  });
  return NextResponse.json({ ok: true, reconciliation: rec ? serialize(rec) : null });
}

/**
 * POST /api/reconciliation
 *   { clientId?, bankAccountKey, periodMonth, openingBalance?, statementBalance?, notes?, reconcile? }
 * Cria/atualiza o cabeçalho. reconcile:true fecha (RECONCILED) se a diferença = 0.
 */
export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const scope = await resolveBankAccountClientScope(user, (body?.clientId as string) ?? null);
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

  const bankAccountKey = String(body?.bankAccountKey || '').trim().toUpperCase();
  const periodMonth = String(body?.periodMonth || '').trim();
  if (!ACCOUNT_KEYS.includes(bankAccountKey)) return NextResponse.json({ ok: false, error: 'bankAccountKey inválido.' }, { status: 400 });
  if (!YEAR_MONTH.test(periodMonth)) return NextResponse.json({ ok: false, error: 'periodMonth inválido (YYYY-MM).' }, { status: 400 });

  const data: Prisma.BankReconciliationUncheckedUpdateInput = {};
  if (body?.openingBalance != null && body.openingBalance !== '') data.openingBalance = new Prisma.Decimal(Number(body.openingBalance) || 0);
  if (body?.statementBalance != null && body.statementBalance !== '') data.statementBalance = new Prisma.Decimal(Number(body.statementBalance) || 0);
  if (body?.notes != null) data.notes = String(body.notes).slice(0, 2000);

  const existing = await prisma.bankReconciliation.upsert({
    where: { clientId_bankAccountKey_periodMonth: { clientId: scope.clientId, bankAccountKey, periodMonth } },
    create: {
      clientId: scope.clientId,
      bankAccountKey,
      periodMonth,
      openingBalance: data.openingBalance != null ? (data.openingBalance as Prisma.Decimal) : new Prisma.Decimal(0),
      statementBalance: data.statementBalance != null ? (data.statementBalance as Prisma.Decimal) : new Prisma.Decimal(0),
      notes: (data.notes as string) ?? null,
      createdById: user.id,
    },
    update: data,
    include: { items: true },
  });

  // Fechar/reabrir
  if (body?.reconcile === true || body?.reconcile === false) {
    const opening = num(existing.openingBalance);
    const statement = num(existing.statementBalance);
    const clearedTotal = existing.items.filter((i) => i.cleared).reduce((s, i) => s + num(i.amount), 0);
    const difference = Math.round((statement - (opening + clearedTotal)) * 100) / 100;
    if (body.reconcile === true && Math.abs(difference) >= 0.005) {
      return NextResponse.json({ ok: false, error: `Diferença de ${difference.toFixed(2)} — ajuste antes de conciliar.` }, { status: 400 });
    }
    await prisma.bankReconciliation.update({
      where: { id: existing.id },
      data: body.reconcile === true
        ? { status: 'RECONCILED', reconciledAt: new Date(), reconciledBy: user.id }
        : { status: 'OPEN', reconciledAt: null, reconciledBy: null },
    });
    await recordAudit({
      request: req, actor: { id: user.id, email: user.email },
      action: body.reconcile === true ? 'reconciliation.close' : 'reconciliation.reopen',
      entity: 'bank_reconciliation', entityId: existing.id, clientId: scope.clientId,
      details: `${bankAccountKey} ${periodMonth}`,
    });
  }

  const full = await prisma.bankReconciliation.findUnique({
    where: { id: existing.id },
    include: { items: { orderBy: [{ txnDate: 'asc' }, { createdAt: 'asc' }] } },
  });
  return NextResponse.json({ ok: true, reconciliation: full ? serialize(full) : null });
}
