import { Prisma, GLEntryPaidStatus, GLEntryType } from '@prisma/client';

const ENTRY_TYPES = new Set<string>(Object.values(GLEntryType));
const PAID_STATUSES = new Set<string>(Object.values(GLEntryPaidStatus));

/** Same filter semantics as GET /api/analytics/entries + SQL clause for monthly aggregates. */
export function buildAnalyticsGLEntryFilters(clientId: string, searchParams: URLSearchParams) {
  const type = searchParams.get('type') || '';
  const payee = searchParams.get('payee') || '';
  const accountCode = searchParams.get('accountCode') || '';
  const periodYM = searchParams.get('period') || '';
  const paidStatus = searchParams.get('paidStatus') || '';
  const search = searchParams.get('search') || '';

  const basePrisma: Prisma.GLEntryWhereInput[] = [{ clientId }];
  const sqlParts: Prisma.Sql[] = [Prisma.sql`e."clientId" = ${clientId}`];

  if (type && ENTRY_TYPES.has(type)) {
    basePrisma.push({ entryType: type as GLEntryType });
    sqlParts.push(Prisma.sql`e."entryType"::text = ${type}`);
  }
  if (payee) {
    basePrisma.push({ payee });
    sqlParts.push(Prisma.sql`e."payee" = ${payee}`);
  }
  if (paidStatus && PAID_STATUSES.has(paidStatus)) {
    basePrisma.push({ paidStatus: paidStatus as GLEntryPaidStatus });
    sqlParts.push(Prisma.sql`e."paidStatus"::text = ${paidStatus}`);
  }
  if (periodYM && /^\d{4}-\d{2}$/.test(periodYM)) {
    const [y, m] = periodYM.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 1));
    basePrisma.push({ entryDate: { gte: start, lt: end } });
    sqlParts.push(Prisma.sql`e."entryDate" >= ${start} AND e."entryDate" < ${end}`);
  }
  const q = search.trim();
  if (q) {
    basePrisma.push({
      OR: [
        { payee: { contains: q, mode: 'insensitive' } },
        { propertyAddress: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { reference: { contains: q, mode: 'insensitive' } },
      ],
    });
    const pattern = `%${q}%`;
    sqlParts.push(
      Prisma.sql`(e."payee" ILIKE ${pattern} OR e."propertyAddress" ILIKE ${pattern} OR e."description" ILIKE ${pattern} OR e."reference" ILIKE ${pattern})`,
    );
  }

  const prismaWithAccount = [...basePrisma];
  if (accountCode) {
    prismaWithAccount.push({ accountCode });
    sqlParts.push(Prisma.sql`e."accountCode" = ${accountCode}`);
  }

  const combine = (parts: Prisma.GLEntryWhereInput[]): Prisma.GLEntryWhereInput =>
    parts.length === 1 ? parts[0] : { AND: parts };

  const where = combine(prismaWithAccount);
  const whereForCpa = combine(basePrisma);
  const monthsWhereSql =
    sqlParts.length === 1 ? sqlParts[0] : Prisma.sql`${Prisma.join(sqlParts, ' AND ')}`;

  return { where, whereForCpa, monthsWhereSql };
}
