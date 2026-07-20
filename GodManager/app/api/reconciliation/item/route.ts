import { NextResponse } from 'next/server';
import { csrfGuard } from '@/lib/csrfGuard';
import { rateLimitGuard } from '@/lib/apiRateLimit';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';

export const dynamic = 'force-dynamic';

async function loadScopedRecon(userClientId: string | null, reconciliationId: string) {
  const rec = await prisma.bankReconciliation.findUnique({
    where: { id: reconciliationId },
    select: { id: true, clientId: true, status: true },
  });
  if (!rec) return { err: 'Conciliação não encontrada.', status: 404 as const };
  if (userClientId && rec.clientId !== userClientId) return { err: 'Sem acesso.', status: 403 as const };
  return { rec };
}

/** POST /api/reconciliation/item  { clientId?, reconciliationId, description, amount, txnDate?, sourceType?, sourceRefId? } */
export async function POST(req: Request) {
  const bad = csrfGuard(req);
  if (bad) return bad;
  const rl = rateLimitGuard(req);
  if (rl) return rl;
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const scope = await resolveBankAccountClientScope(user, (body?.clientId as string) ?? null);
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

  const reconciliationId = String(body?.reconciliationId || '').trim();
  const description = String(body?.description || '').trim().slice(0, 300);
  const amount = Number(body?.amount);
  if (!reconciliationId) return NextResponse.json({ ok: false, error: 'reconciliationId obrigatório.' }, { status: 400 });
  if (!description) return NextResponse.json({ ok: false, error: 'Descrição obrigatória.' }, { status: 400 });
  if (!Number.isFinite(amount) || amount === 0) return NextResponse.json({ ok: false, error: 'Valor inválido (use + para crédito, - para débito).' }, { status: 400 });

  const found = await loadScopedRecon(scope.clientId, reconciliationId);
  if ('err' in found) return NextResponse.json({ ok: false, error: found.err }, { status: found.status });

  let txnDate: Date | null = null;
  if (body?.txnDate) { const d = new Date(String(body.txnDate)); if (!Number.isNaN(d.getTime())) txnDate = d; }
  const sourceType = ['MANUAL', 'RAMP', 'TENANT_PAYMENT', 'EXPENSE', 'GL', 'PLAID'].includes(String(body?.sourceType))
    ? String(body.sourceType) : 'MANUAL';

  const item = await prisma.bankReconciliationItem.create({
    data: {
      reconciliationId,
      description,
      amount: new Prisma.Decimal(amount),
      txnDate,
      sourceType,
      sourceRefId: body?.sourceRefId ? String(body.sourceRefId).slice(0, 200) : null,
      category: body?.category ? String(body.category).slice(0, 120) : null,
    },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, itemId: item.id });
}

/** PATCH /api/reconciliation/item  { clientId?, itemId, cleared?, description?, amount? } */
export async function PATCH(req: Request) {
  const bad = csrfGuard(req);
  if (bad) return bad;
  const rl = rateLimitGuard(req);
  if (rl) return rl;
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const scope = await resolveBankAccountClientScope(user, (body?.clientId as string) ?? null);
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

  const itemId = String(body?.itemId || '').trim();
  if (!itemId) return NextResponse.json({ ok: false, error: 'itemId obrigatório.' }, { status: 400 });
  const item = await prisma.bankReconciliationItem.findUnique({
    where: { id: itemId },
    select: { id: true, reconciliationId: true },
  });
  if (!item) return NextResponse.json({ ok: false, error: 'Item não encontrado.' }, { status: 404 });
  const found = await loadScopedRecon(scope.clientId, item.reconciliationId);
  if ('err' in found) return NextResponse.json({ ok: false, error: found.err }, { status: found.status });

  const data: Prisma.BankReconciliationItemUncheckedUpdateInput = {};
  if (typeof body?.cleared === 'boolean') data.cleared = body.cleared;
  if (body?.description != null) data.description = String(body.description).trim().slice(0, 300);
  if (body?.amount != null && body.amount !== '' && Number.isFinite(Number(body.amount))) data.amount = new Prisma.Decimal(Number(body.amount));
  if (body?.category !== undefined) data.category = body.category ? String(body.category).slice(0, 120) : null;
  await prisma.bankReconciliationItem.update({ where: { id: itemId }, data });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/reconciliation/item?itemId=&clientId= */
export async function DELETE(req: Request) {
  const bad = csrfGuard(req);
  if (bad) return bad;
  const rl = rateLimitGuard(req);
  if (rl) return rl;
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  const url = new URL(req.url);
  const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
  const itemId = (url.searchParams.get('itemId') || '').trim();
  if (!itemId) return NextResponse.json({ ok: false, error: 'itemId obrigatório.' }, { status: 400 });
  const item = await prisma.bankReconciliationItem.findUnique({ where: { id: itemId }, select: { id: true, reconciliationId: true } });
  if (!item) return NextResponse.json({ ok: false, error: 'Item não encontrado.' }, { status: 404 });
  const found = await loadScopedRecon(scope.clientId, item.reconciliationId);
  if ('err' in found) return NextResponse.json({ ok: false, error: found.err }, { status: found.status });
  await prisma.bankReconciliationItem.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
}
