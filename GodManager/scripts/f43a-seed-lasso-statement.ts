/**
 * F4.3.A — Seed Owner Statement Lasso April 2026.
 * Idempotent. Run local then production.
 *
 * Run local:  npx tsx scripts/f43a-seed-lasso-statement.ts
 * Run prod:   DATABASE_URL="$DATABASE_URL_PRODUCTION" \
 *               npx tsx scripts/f43a-seed-lasso-statement.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LINE_ITEMS = [
  {
    lineType: 'income',
    description:
      'Reembolso - Lancamento duplicado em Janeiro (Fence, Reparos e Limpeza de A/C)',
    amount: 1820.0,
    sortOrder: 1,
  },
  {
    lineType: 'income',
    description: 'Reembolso - Lancamento duplicado em Janeiro (Photo)',
    amount: 199.0,
    sortOrder: 2,
  },
  {
    lineType: 'income',
    description: 'Aluguel referente a Abril 2026',
    amount: 1450.99,
    sortOrder: 3,
  },
  {
    lineType: 'expense',
    description: 'HOA - Janeiro 2026',
    amount: 137.2,
    sortOrder: 4,
  },
  {
    lineType: 'expense',
    description: 'HOA - Abril 2026',
    amount: 137.2,
    sortOrder: 5,
  },
];

async function main() {
  const props = await prisma.property.findMany({
    where: { address: { contains: 'Lasso', mode: 'insensitive' } },
  });
  if (props.length === 0) {
    console.log('SKIP: no Lasso property in this DB');
    return;
  }
  const prop = props[0];
  console.log(
    'Property:',
    prop.code,
    prop.id,
    'clientId=',
    prop.clientId
  );

  const totalIncome = LINE_ITEMS.filter((l) => l.lineType === 'income').reduce(
    (s, l) => s + l.amount,
    0
  );
  const totalExpenses = LINE_ITEMS.filter((l) => l.lineType === 'expense').reduce(
    (s, l) => s + l.amount,
    0
  );
  const netPayout = totalIncome - totalExpenses;

  console.log(
    'totalIncome:',
    totalIncome,
    'totalExpenses:',
    totalExpenses,
    'netPayout:',
    netPayout
  );

  const ymp = await prisma.ownerMonthPayout.upsert({
    where: {
      propertyId_yearMonth: { propertyId: prop.id, yearMonth: '2026-04' },
    },
    update: {
      totalIncome,
      totalExpenses,
      netPayout,
      previousBalance: 0,
    },
    create: {
      propertyId: prop.id,
      yearMonth: '2026-04',
      clientId: prop.clientId,
      totalIncome,
      totalExpenses,
      netPayout,
      previousBalance: 0,
      notes: 'F4.3.A seed Lasso April 2026 statement',
    },
  });
  console.log('OwnerMonthPayout id:', ymp.id);

  await prisma.statementLineItem.deleteMany({
    where: { ownerMonthPayoutId: ymp.id },
  });

  for (const li of LINE_ITEMS) {
    await prisma.statementLineItem.create({
      data: {
        ownerMonthPayoutId: ymp.id,
        clientId: prop.clientId,
        lineType: li.lineType,
        description: li.description,
        amount: li.amount,
        sortOrder: li.sortOrder,
      },
    });
  }
  console.log('StatementLineItems created:', LINE_ITEMS.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
