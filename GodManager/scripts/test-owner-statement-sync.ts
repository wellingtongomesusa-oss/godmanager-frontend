/**
 * Smoke test do sync. NÃO modifica TenantPayment/PmExpense.
 *
 * Uso:
 *   DATABASE_URL="..." npx tsx scripts/test-owner-statement-sync.ts --property-code P0002 --year-month 2026-05 --dry-run
 *
 * Em --dry-run apenas imprime quantos TenantPayments e PmExpenses encontrou,
 * sem chamar a função de sync.
 */

import { prisma } from '@/lib/db';
import { syncOwnerStatementForProperty } from '@/lib/ownerStatementSync';
import { monthRefQueryValues, normalizeYearMonthForWrite } from '@/lib/pmMonthRef';

function getArg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

function monthBoundsUtc(yearMonth: string): { start: Date; end: Date } | null {
  const norm = normalizeYearMonthForWrite(yearMonth);
  if (!norm) return null;
  const [ys, ms] = norm.split('-');
  const y = Number(ys);
  const mo = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(mo)) return null;
  const start = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, mo, 0, 23, 59, 59, 999));
  return { start, end };
}

async function main() {
  const propertyCodeRaw = getArg('--property-code');
  const yearMonthRaw = getArg('--year-month');
  const dryRun = process.argv.includes('--dry-run');

  if (!propertyCodeRaw?.trim()) {
    console.error('Missing --property-code');
    process.exit(1);
  }
  const propertyCode = propertyCodeRaw.trim().toUpperCase();

  const yearMonth = yearMonthRaw?.trim();
  if (!yearMonth || !/^\d{4}-(0[1-9]|1[0-2])$/.test(yearMonth)) {
    console.error('Missing or invalid --year-month (YYYY-MM)');
    process.exit(1);
  }

  const property = await prisma.property.findUnique({
    where: { code: propertyCode },
    select: { id: true, clientId: true },
  });
  if (!property) {
    console.error(`Property not found for code=${propertyCode}`);
    process.exit(1);
  }

  const clientId = property.clientId;
  if (!clientId) {
    console.error('Property has no clientId — cannot derive tenant scope for sync.');
    process.exit(1);
  }

  const bounds = monthBoundsUtc(yearMonth);
  if (!bounds) {
    console.error('Invalid month');
    process.exit(1);
  }

  const monthVals = monthRefQueryValues(normalizeYearMonthForWrite(yearMonth)!);

  const rentalCount = await prisma.tenantPayment.count({
    where: {
      propertyId: property.id,
      clientId,
      cashAccount: { startsWith: '1150' },
      paymentDate: { gte: bounds.start, lte: bounds.end },
    },
  });

  const expenseCount = await prisma.pmExpense.count({
    where: {
      propertyId: property.id,
      clientId,
      monthRef: { in: monthVals },
      status: { not: 'CANCELLED' },
    },
  });

  console.log(
    JSON.stringify(
      {
        propertyId: property.id,
        clientId,
        yearMonth: normalizeYearMonthForWrite(yearMonth),
        dryRun,
        tenantPaymentsInMonth: rentalCount,
        pmExpensesInMonth: expenseCount,
      },
      null,
      2
    )
  );

  if (dryRun) {
    await prisma.$disconnect();
    return;
  }

  const actor = await prisma.user.findFirst({
    where: { status: 'active' },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!actor) {
    console.error('No active user found for actorId');
    process.exit(1);
  }

  const out = await syncOwnerStatementForProperty({
    propertyId: property.id,
    yearMonth,
    clientId,
    actorId: actor.id,
  });

  console.log(JSON.stringify(out, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect().finally(() => process.exit(1));
});
