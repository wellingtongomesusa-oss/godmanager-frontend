import { PrismaClient } from '@prisma/client';
import { SEED_USERS } from '../lib/seed';

const prisma = new PrismaClient();

async function main() {
  for (const u of SEED_USERS) {
    await prisma.user.upsert({
      where: { id: u.id },
      create: {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phone: u.phone ?? null,
        role: u.role,
        status: u.status,
        permissions: u.permissions,
        passwordHash: u.passwordHash,
        createdAt: new Date(u.createdAt),
        lastActive: new Date(u.lastActive),
        clientId: null,
      },
      update: {
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phone: u.phone ?? null,
        role: u.role,
        status: u.status,
        permissions: u.permissions,
        passwordHash: u.passwordHash,
        lastActive: new Date(u.lastActive),
      },
    });
  }
  console.log(`[prisma/seed] Upserted ${SEED_USERS.length} users.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
