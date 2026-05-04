import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function normalizeName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  return trimmed.replace(/\s+/g, ' ');
}

function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim().toLowerCase();
  if (!trimmed) return null;
  if (!/^[^@\s]+@[^@\s]+\.[^@]+$/.test(trimmed)) return null;
  return trimmed;
}

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  return trimmed;
}

async function main() {
  const props = await prisma.property.findMany({
    where: {
      clientId: { not: null },
      ownerId: null,
      AND: [{ ownerName: { not: null } }, { ownerName: { not: '' } }],
    },
    select: {
      id: true,
      code: true,
      clientId: true,
      ownerName: true,
      ownerEmail: true,
      ownerPhone: true,
    },
  });

  console.log('Properties candidatas (com ownerName + sem ownerId):', props.length);

  const groups = new Map<
    string,
    {
      clientId: string;
      name: string;
      email: string | null;
      phone: string | null;
      propertyIds: string[];
    }
  >();

  for (const p of props) {
    const name = normalizeName(p.ownerName);
    if (!name || !p.clientId) continue;
    const key = `${p.clientId}::${name.toLowerCase()}`;
    if (!groups.has(key)) {
      groups.set(key, {
        clientId: p.clientId,
        name,
        email: normalizeEmail(p.ownerEmail),
        phone: normalizePhone(p.ownerPhone),
        propertyIds: [],
      });
    } else {
      const g = groups.get(key)!;
      if (!g.email) g.email = normalizeEmail(p.ownerEmail);
      if (!g.phone) g.phone = normalizePhone(p.ownerPhone);
    }
    groups.get(key)!.propertyIds.push(p.id);
  }

  console.log('Owners unicos a criar:', groups.size);

  let createdOwners = 0;
  let reusedOwners = 0;
  let linkedProperties = 0;

  for (const g of groups.values()) {
    const existing = await prisma.owner.findFirst({
      where: {
        clientId: g.clientId,
        name: { equals: g.name, mode: 'insensitive' },
      },
    });

    let owner: Awaited<ReturnType<typeof prisma.owner.findFirst>>;

    if (existing) {
      owner = existing;
      reusedOwners++;
    } else {
      let found: typeof owner = null;
      if (g.email) {
        const byEmail = await prisma.owner.findFirst({
          where: { clientId: g.clientId, email: g.email },
        });
        if (byEmail) {
          found = byEmail;
          reusedOwners++;
        }
      }
      if (found) {
        owner = found;
      } else {
        owner = await prisma.owner.create({
          data: {
            clientId: g.clientId,
            name: g.name,
            email: g.email,
            phone: g.phone,
            active: true,
          },
        });
        createdOwners++;
      }
    }

    const result = await prisma.property.updateMany({
      where: {
        id: { in: g.propertyIds },
        ownerId: null,
      },
      data: { ownerId: owner.id },
    });
    linkedProperties += result.count;
  }

  console.log('--- BACKFILL SUMMARY ---');
  console.log('Owners criados:', createdOwners);
  console.log('Owners reutilizados:', reusedOwners);
  console.log('Properties ligadas:', linkedProperties);
}

main()
  .catch((e) => {
    console.error('FAIL:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
