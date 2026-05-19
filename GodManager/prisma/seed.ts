import { PrismaClient } from '@prisma/client';
import { SEED_USER_DEFS } from '../lib/seed';
import { hashPassword } from '../lib/password';

const prisma = new PrismaClient();

async function main() {
  for (const def of SEED_USER_DEFS) {
    const { plainPassword, ...rest } = def;
    const passwordHash = await hashPassword(plainPassword);
    await prisma.user.upsert({
      where: { id: def.id },
      create: {
        id: rest.id,
        firstName: rest.firstName,
        lastName: rest.lastName,
        email: rest.email,
        phone: rest.phone ?? null,
        role: rest.role,
        status: rest.status,
        permissions: rest.permissions,
        passwordHash,
        createdAt: new Date(rest.createdAt),
        lastActive: new Date(rest.lastActive),
        clientId: null,
      },
      update: {
        firstName: rest.firstName,
        lastName: rest.lastName,
        email: rest.email,
        phone: rest.phone ?? null,
        role: rest.role,
        status: rest.status,
        permissions: rest.permissions,
        passwordHash,
        lastActive: new Date(rest.lastActive),
      },
    });
  }
  console.log(`[prisma/seed] Upserted ${SEED_USER_DEFS.length} users.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
