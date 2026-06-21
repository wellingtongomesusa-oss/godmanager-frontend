import { PrismaClient, Prisma } from '@prisma/client';
import {
  assertUserIntegrityOnCreate,
  assertUserIntegrityOnUpdate,
  prismaRoleStatusClient,
  updateDataTouchesIntegrity,
} from '@/lib/userIntegrity';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient(): PrismaClient {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  const extended = base.$extends({
    query: {
      user: {
        async create({ args, query }) {
          assertUserIntegrityOnCreate(args.data as Record<string, unknown>);
          return query(args);
        },
        async createMany({ args, query }) {
          const rows = Array.isArray(args.data) ? args.data : [args.data];
          for (const row of rows) {
            assertUserIntegrityOnCreate(row as Record<string, unknown>);
          }
          return query(args);
        },
        async update({ args, query }) {
          const existing = await base.user.findUnique({
            where: args.where,
            select: { role: true, status: true, clientId: true },
          });
          if (existing) {
            assertUserIntegrityOnUpdate(
              prismaRoleStatusClient(existing.role, existing.status, existing.clientId),
              args.data as Record<string, unknown>,
            );
          }
          return query(args);
        },
        async updateMany({ args, query }) {
          const patch = args.data as Record<string, unknown>;
          if (updateDataTouchesIntegrity(patch)) {
            const rows = await base.user.findMany({
              where: args.where,
              select: { role: true, status: true, clientId: true },
            });
            for (const row of rows) {
              assertUserIntegrityOnUpdate(
                prismaRoleStatusClient(row.role, row.status, row.clientId),
                patch,
              );
            }
          }
          return query(args);
        },
        async upsert({ args, query }) {
          const existing = await base.user.findUnique({
            where: args.where,
            select: { role: true, status: true, clientId: true },
          });
          if (existing) {
            assertUserIntegrityOnUpdate(
              prismaRoleStatusClient(existing.role, existing.status, existing.clientId),
              args.update as Record<string, unknown>,
            );
          } else {
            assertUserIntegrityOnCreate(args.create as Record<string, unknown>);
          }
          return query(args);
        },
      },
    },
  });

  return extended as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/** Execução dentro de transação com SET LOCAL app.current_client_id para RLS (ver migration enable_rls). */
export async function withRlsScope<T>(
  user: { id: string; role: string; clientId: string | null },
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (process.env.DISABLE_RLS === '1') {
    return fn(prisma as unknown as Prisma.TransactionClient);
  }

  return prisma.$transaction(async (tx) => {
    const scopeValue = user.role === 'super_admin' ? 'SUPER_ADMIN_BYPASS' : user.clientId ?? '';
    const escaped = scopeValue.replace(/'/g, "''");
    await tx.$executeRawUnsafe(`SET LOCAL app.current_client_id = '${escaped}'`);
    return fn(tx);
  });
}
