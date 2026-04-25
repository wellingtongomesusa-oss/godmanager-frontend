import { prisma } from '@/lib/db';
import { getEffectiveMonthlyRent, dec } from '@/lib/pmRent';
import type { PmExpenseStatus, PmPackage } from '@prisma/client';

const PM_ACTIVE: PmExpenseStatus[] = ['SCHEDULED', 'PAID', 'PENDING'];

export async function sumOwnerChargedForPropertyMonth(propertyId: string, yearMonth: string) {
  const agg = await prisma.pmExpense.aggregate({
    where: {
      propertyId,
      monthRef: yearMonth,
      status: { in: PM_ACTIVE },
    },
    _sum: { ownerCharged: true },
  });
  return dec(agg._sum.ownerCharged);
}

export async function computeNetForPropertyMonth(propertyId: string, yearMonth: string) {
  const rent = await getEffectiveMonthlyRent(propertyId);
  const exp = await sumOwnerChargedForPropertyMonth(propertyId, yearMonth);
  return { rent, expensesOwnerCharged: exp, net: Math.round((rent - exp) * 100) / 100 };
}

export function packageLabel(pkg: PmPackage): string {
  const m: Record<PmPackage, string> = {
    PACOTE_1: 'P1 (15%)',
    PACOTE_2: 'P2 (18%)',
    PACOTE_3: 'P3 (25%)',
    PACOTE_4: 'P4 (0%)',
  };
  return m[pkg] || pkg;
}

export async function getPayoutState(propertyId: string, yearMonth: string) {
  const p = await prisma.ownerMonthPayout.findUnique({
    where: { propertyId_yearMonth: { propertyId, yearMonth: yearMonth } },
  });
  return p;
}
