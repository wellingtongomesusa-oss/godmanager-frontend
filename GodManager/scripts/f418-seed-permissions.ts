/**
 * F4.1.8.A.3 seed allow-list /manager-pro/owners.
 *
 * Idempotent: re-run = 0 changes.
 * Run local:    npx tsx scripts/f418-seed-permissions.ts
 * Run prod:     DATABASE_URL="$DATABASE_URL_PRODUCTION" \
 *                 npx tsx scripts/f418-seed-permissions.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ALLOWLIST: { email: string; resource: string; action: string }[] = [
  { email: 'info@managerprop.com', resource: 'owners', action: '*' },
  { email: 'lucas@managerprop.com', resource: 'owners', action: '*' },
];

async function main() {
  const client = await prisma.client.findFirst({
    where: { companyName: 'Manager Prop' },
  });
  if (!client) {
    console.error('FAIL: Manager Prop client not found');
    process.exit(1);
  }
  console.log('Manager Prop:', client.id);

  for (const entry of ALLOWLIST) {
    const user = await prisma.user.findUnique({ where: { email: entry.email } });
    if (!user) {
      console.log('SKIP: user not found', entry.email);
      continue;
    }

    const existing = await prisma.userPermission.findUnique({
      where: {
        userId_clientId_resource_action: {
          userId: user.id,
          clientId: client.id,
          resource: entry.resource,
          action: entry.action,
        },
      },
    });

    if (existing) {
      console.log('Already exists:', entry.email, entry.resource, entry.action);
      continue;
    }

    const perm = await prisma.userPermission.create({
      data: {
        userId: user.id,
        clientId: client.id,
        resource: entry.resource,
        action: entry.action,
        notes: 'F4.1.8.A seed allow-list',
      },
    });
    console.log('Created:', entry.email, '->', perm.id);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
