import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ensureOwnerMonthPayoutWithClient } from '@/lib/ownerStatementEmail';
import type { ClientScopeUser } from '@/lib/clientScope';

/** 'YYYY-MM' → mês seguinte 'YYYY-MM'. */
export function nextYearMonth(ym: string): string {
  const [y, m] = ym.split('-').map((n) => parseInt(n, 10));
  const d = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
  return `${d.y}-${String(d.m).padStart(2, '0')}`;
}

/**
 * Carry-over: o saldo final do mês (previousBalance + netPayout − paidAmount) vira o
 * saldo inicial (previousBalance) do mês seguinte. Só grava se o mês seguinte ainda
 * estiver ABERTO (nunca altera um demonstrativo já fechado). Idempotente.
 * Retorna o yearMonth para onde carregou, ou null.
 */
export async function carryOverToNextMonth(opts: {
  payoutId: string;
  propertyId: string;
  yearMonthNorm: string;
  scopeUser: ClientScopeUser;
}): Promise<string | null> {
  try {
    const cur = await prisma.ownerMonthPayout.findUnique({
      where: { id: opts.payoutId },
      select: { previousBalance: true, netPayout: true, paidAmount: true },
    });
    if (!cur) return null;
    const prevBal = cur.previousBalance ?? new Prisma.Decimal(0);
    const paid = cur.paidAmount ?? new Prisma.Decimal(0);
    const endBalance = prevBal.add(cur.netPayout ?? new Prisma.Decimal(0)).sub(paid);

    const nextYm = nextYearMonth(opts.yearMonthNorm);
    const ensuredNext = await ensureOwnerMonthPayoutWithClient({
      scopeUser: opts.scopeUser,
      propertyId: opts.propertyId,
      yearMonthNorm: nextYm,
    });
    if (!ensuredNext.ok) return null;

    const nextRow = await prisma.ownerMonthPayout.findUnique({
      where: { id: ensuredNext.payoutId },
      select: { closedAt: true },
    });
    if (nextRow && !nextRow.closedAt) {
      await prisma.ownerMonthPayout.update({
        where: { id: ensuredNext.payoutId },
        data: { previousBalance: endBalance },
      });
      return nextYm;
    }
    return null;
  } catch (e) {
    console.error('[carryOverToNextMonth]', e instanceof Error ? e.message : 'error');
    return null;
  }
}
