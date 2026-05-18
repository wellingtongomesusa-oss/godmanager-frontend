import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

export type Tx =
  | Omit<
      PrismaClient,
      '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
    >
  | Prisma.TransactionClient;

/**
 * Soma todos os line-items do payout e grava totalIncome/totalExpenses/netPayout no OwnerMonthPayout.
 */
export async function recomputeOwnerMonthPayoutTotals(
  payoutId: string,
  tx: Tx
): Promise<{ totalIncome: Prisma.Decimal; totalExpenses: Prisma.Decimal; netPayout: Prisma.Decimal }> {
  const allLines = await tx.statementLineItem.findMany({
    where: { ownerMonthPayoutId: payoutId },
    select: { lineType: true, amount: true },
  });

  let inc = new Prisma.Decimal(0);
  let exp = new Prisma.Decimal(0);
  for (const li of allLines) {
    if (li.lineType === 'income') inc = inc.add(li.amount);
    else if (li.lineType === 'expense') exp = exp.add(li.amount);
  }
  const net = inc.sub(exp);

  await tx.ownerMonthPayout.update({
    where: { id: payoutId },
    data: {
      totalIncome: inc,
      totalExpenses: exp,
      netPayout: net,
    },
  });

  return {
    totalIncome: inc,
    totalExpenses: exp,
    netPayout: net,
  };
}
