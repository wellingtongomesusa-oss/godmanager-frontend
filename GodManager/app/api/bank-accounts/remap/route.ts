import { NextResponse } from 'next/server';
import { csrfGuard } from '@/lib/csrfGuard';
import { rateLimitGuard } from '@/lib/apiRateLimit';
import type { BankAccountType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import {
  canManageBankBalances,
  isValidBankAccountType,
  resolveBankAccountClientScope,
} from '@/lib/bankAccountBalancesScope';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

/**
 * POST /api/bank-accounts/remap  { a, b, clientId? }
 * Troca (swap) os rótulos de tipo de conta entre A e B em TODOS os saldos do cliente.
 * Serve para corrigir facilmente o mapeamento se uma conta foi classificada errada
 * (ex.: Trust <-> Operating trocados). Feito por id (o enum não tem valor temporário).
 */
export async function POST(req: Request) {
  const bad = csrfGuard(req);
  if (bad) return bad;
  const rl = rateLimitGuard(req);
  if (rl) return rl;
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  }
  if (!canManageBankBalances(user.role)) {
    return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const scope = await resolveBankAccountClientScope(user, body?.clientId);
    if (!scope.ok) {
      return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
    }

    const a = String(body?.a ?? '').trim();
    const b = String(body?.b ?? '').trim();
    if (!isValidBankAccountType(a) || !isValidBankAccountType(b)) {
      return NextResponse.json(
        { ok: false, error: 'a/b inválidos. Use TRUST_CHASE, OPERATING_TRUST ou DEPOSIT_SECURITY.' },
        { status: 400 },
      );
    }
    if (a === b) {
      return NextResponse.json({ ok: false, error: 'a e b devem ser diferentes.' }, { status: 400 });
    }

    const typeA = a as BankAccountType;
    const typeB = b as BankAccountType;

    const [aRows, bRows] = await Promise.all([
      prisma.bankAccountBalance.findMany({
        where: { clientId: scope.clientId, accountType: typeA },
        select: { id: true },
      }),
      prisma.bankAccountBalance.findMany({
        where: { clientId: scope.clientId, accountType: typeB },
        select: { id: true },
      }),
    ]);
    const aIds = aRows.map((r) => r.id);
    const bIds = bRows.map((r) => r.id);

    await prisma.$transaction([
      prisma.bankAccountBalance.updateMany({
        where: { id: { in: aIds } },
        data: { accountType: typeB },
      }),
      prisma.bankAccountBalance.updateMany({
        where: { id: { in: bIds } },
        data: { accountType: typeA },
      }),
    ]);

    await recordAudit({
      request: req,
      actor: { id: user.id, email: user.email },
      action: 'bank_balance.remap',
      entity: 'bank_account',
      entityId: scope.clientId,
      details: `swap ${a} (${aIds.length}) <-> ${b} (${bIds.length})`,
      clientId: scope.clientId,
    });

    return NextResponse.json({ ok: true, swapped: { [a]: bIds.length, [b]: aIds.length } });
  } catch (e) {
    console.error('[api/bank-accounts/remap POST]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}
