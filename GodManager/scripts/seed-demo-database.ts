/**
 * Seed do Postgres DEMO.
 *
 * Le DATABASE_URL directamente do environment.
 *
 * Uso:
 *   - Local:   DATABASE_URL=... npm run seed:demo
 *   - Railway: definir DATABASE_URL no service demo (ja vem do internal URL)
 *              e correr `npm run seed:demo` via Railway CLI ou custom command.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { hashPassword } from '../lib/password';

if (!process.env.DATABASE_URL) {
  console.error('ERRO: DATABASE_URL nao definido no environment.');
  process.exit(1);
}
const url = process.env.DATABASE_URL;
console.log('Using DB:', url.replace(/:[^:@/]+@/, ':***@').slice(0, 80) + '...');

const prisma = new PrismaClient();

const FL_CITIES = [
  'Winter Garden',
  'Orlando',
  'Kissimmee',
  'Davenport',
  'Clermont',
  'Apopka',
  'Ocoee',
  'Windermere',
  'Lakeland',
  'Tampa',
];
const STREETS = [
  'Oak Drive',
  'Maple Lane',
  'Sunset Boulevard',
  'Pine Avenue',
  'Magnolia Street',
  'Palm Way',
  'Cedar Court',
  'Riverside Drive',
  'Mountain View',
  'Lakeshore Drive',
];
const OWNERS = [
  { name: 'Smith Holdings LLC', email: 'ops@smithholdings.com' },
  { name: 'Johnson Properties Inc', email: 'admin@johnsonprops.com' },
  { name: 'Davis Real Estate', email: 'contact@davisre.com' },
  { name: 'Wilson Capital Group', email: 'finance@wilsoncap.com' },
  { name: 'Anderson Investments LLC', email: 'pm@andersoninv.com' },
  { name: 'Brown Realty Trust', email: 'trust@brownrealty.com' },
  { name: 'Martinez Holdings', email: 'office@martinezhold.com' },
  { name: 'Lee Property Management LLC', email: 'leasing@leepm.com' },
  { name: 'Garcia Real Estate', email: 'team@garciare.com' },
  { name: 'Thompson Capital', email: 'admin@thompsoncap.com' },
];
const FIRSTNAMES = [
  'John',
  'Jane',
  'Michael',
  'Sarah',
  'David',
  'Emily',
  'Robert',
  'Jennifer',
  'William',
  'Jessica',
];
const LASTNAMES = [
  'Anderson',
  'Martin',
  'Wilson',
  'Thompson',
  'Brown',
  'Davis',
  'Garcia',
  'Rodriguez',
  'Lopez',
  'Hernandez',
];
const VENDORS: Array<{ companyName: string; trade: string; serviceType: string }> = [
  { companyName: 'Elite Plumbing Solutions', trade: 'plumbing', serviceType: 'Plumbing' },
  { companyName: 'Bright Electric Co', trade: 'electrical', serviceType: 'Electrical' },
  { companyName: 'Green Lawn Services', trade: 'lawn', serviceType: 'Lawn & Garden' },
  { companyName: 'ProClean House Services', trade: 'cleaning', serviceType: 'Cleaning' },
  { companyName: 'Florida HVAC Masters', trade: 'hvac', serviceType: 'HVAC' },
  { companyName: 'Sunshine Painters', trade: 'painting', serviceType: 'Painting' },
  { companyName: 'Aqua Pool Care', trade: 'pool', serviceType: 'Pool Service' },
  { companyName: 'Reliable Roofing Inc', trade: 'roofing', serviceType: 'Roofing' },
  { companyName: 'QuickFix Handyman', trade: 'handyman', serviceType: 'Handyman' },
  { companyName: 'Master Landscaping', trade: 'landscaping', serviceType: 'Landscaping' },
];

function rnd<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function rndInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pad(n: number, len = 4): string {
  return String(n).padStart(len, '0');
}
function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

async function seedAdmin() {
  const email = 'demo@godmanager.us';
  const password = 'Demo@2026';
  const passwordHash = hashPassword(password);
  const data = {
    firstName: 'Demo',
    lastName: 'Admin',
    role: 'admin' as const,
    status: 'active' as const,
    passwordHash,
    permissions: [],
  };
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({ where: { email }, data });
    console.log('[admin] actualizado:', email);
  } else {
    await prisma.user.create({ data: { email, ...data } });
    console.log('[admin] criado:', email);
  }
}

async function seedProperties() {
  await prisma.property.deleteMany({});
  const props: Prisma.PropertyCreateManyInput[] = [];
  for (let i = 1; i <= 20; i++) {
    const code = 'P' + pad(i);
    const num = rndInt(100, 9999);
    const street = rnd(STREETS);
    const city = rnd(FL_CITIES);
    const zip = String(rndInt(32700, 34800));
    const owner = rnd(OWNERS);
    const rent = rndInt(1800, 4500);
    const deposit = rent;
    const status = rnd(['approved', 'pending', 'approved', 'approved', 'active']);
    const bedrooms = rndInt(2, 5);
    const bathrooms = rndInt(1, 4);
    const sqft = rndInt(1100, 3500);
    props.push({
      code,
      address: `${num} ${street}`,
      city,
      state: 'FL',
      zip,
      ownerName: owner.name,
      ownerEmail: owner.email,
      ownerPhone: `(407) ${rndInt(200, 999)}-${rndInt(1000, 9999)}`,
      rent: new Prisma.Decimal(rent),
      deposit: new Prisma.Decimal(deposit),
      bedrooms,
      bathrooms,
      mgmtFeePct: new Prisma.Decimal(8),
      status,
      metadata: { sqft, source: 'demo-seed' },
    });
  }
  await prisma.property.createMany({ data: props });
  console.log('[properties] 20 criadas');
}

async function seedTenants() {
  await prisma.tenant.deleteMany({});
  const props = await prisma.property.findMany({ take: 10, orderBy: { code: 'asc' } });
  for (let i = 0; i < 10; i++) {
    const fn = rnd(FIRSTNAMES);
    const ln = rnd(LASTNAMES);
    const code = 'T' + pad(i + 1);
    const moveIn = new Date(2025, rndInt(0, 11), rndInt(1, 28));
    const leaseTo = new Date(moveIn.getTime() + 365 * 24 * 60 * 60 * 1000);
    await prisma.tenant.create({
      data: {
        code,
        name: `${fn} ${ln}`,
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}@email.com`,
        phone: `(407) ${rndInt(200, 999)}-${rndInt(1000, 9999)}`,
        propertyId: props[i].id,
        moveIn,
        leaseTo,
        rent: props[i].rent,
        deposit: props[i].deposit,
        status: 'active',
        tenantType: 'long_term',
        metadata: { source: 'demo-seed' },
      },
    });
  }
  console.log('[tenants] 10 criados');
}

async function seedVendors() {
  await prisma.pmVendor.deleteMany({});
  for (const v of VENDORS) {
    const num = rndInt(100, 9999);
    const street = rnd(STREETS);
    const city = rnd(FL_CITIES);
    await prisma.pmVendor.create({
      data: {
        companyName: v.companyName,
        contactName: rnd(FIRSTNAMES) + ' ' + rnd(LASTNAMES),
        email: 'contact@' + slug(v.companyName) + '.com',
        phone: `(407) ${rndInt(200, 999)}-${rndInt(1000, 9999)}`,
        addressStreet: `${num} ${street}`,
        addressCity: city,
        addressState: 'FL',
        addressZip: String(rndInt(32700, 34800)),
        trade: v.trade,
        serviceType: v.serviceType,
        status: 'Active',
        source: 'demo-seed',
      },
    });
  }
  console.log('[vendors] 10 criados');
}

async function main() {
  console.log('=== Seed Demo Database ===');
  await seedAdmin();
  await seedProperties();
  await seedTenants();
  await seedVendors();
  const counts = {
    users: await prisma.user.count(),
    properties: await prisma.property.count(),
    tenants: await prisma.tenant.count(),
    vendors: await prisma.pmVendor.count(),
  };
  console.log('=== Seed completo ===');
  console.log(counts);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
