import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const CLIENT_ID = 'cmoqec9bw0000057uu4p5h15a';

async function main() {
  // 1. Procurar tenant Restrepo (exemplo do alert)
  console.log('=== 1. Tenants com "restrepo" no nome (Manager Prop) ===');
  const restrepo = await prisma.tenant.findMany({
    where: {
      clientId: CLIENT_ID,
      name: { contains: 'restrepo', mode: 'insensitive' },
    },
    select: {
      id: true,
      name: true,
      propertyId: true,
      property: { select: { address: true } },
    },
  });
  console.log(JSON.stringify(restrepo, null, 2));

  // 2. Stats gerais
  console.log('\n=== 2. Stats tenants Manager Prop ===');
  const totalTenants = await prisma.tenant.count({ where: { clientId: CLIENT_ID } });
  const tenantsWithProperty = await prisma.tenant.count({
    where: { clientId: CLIENT_ID, propertyId: { not: null } },
  });
  console.log(`Total tenants: ${totalTenants}`);
  console.log(`Com propertyId definido: ${tenantsWithProperty}`);
  console.log(`SEM propertyId: ${totalTenants - tenantsWithProperty}`);

  // 3. Para 1 payment matched a property, ver tenants candidatos lá
  console.log('\n=== 3. Payment matched + tenants na mesma property ===');
  const matchedPayment = await prisma.tenantPayment.findFirst({
    where: { clientId: CLIENT_ID, propertyId: { not: null } },
    select: { payerName: true, propertyAddress: true, propertyId: true },
  });
  if (matchedPayment) {
    console.log(`Payment exemplo: payer="${matchedPayment.payerName}" / address="${matchedPayment.propertyAddress}"`);
    const tenantsThere = await prisma.tenant.findMany({
      where: { clientId: CLIENT_ID, propertyId: matchedPayment.propertyId },
      select: { id: true, name: true },
    });
    console.log(`Tenants na property ${matchedPayment.propertyId}:`);
    console.log(JSON.stringify(tenantsThere, null, 2));
  } else {
    console.log('Nenhum payment com propertyId — algo mais grave.');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
