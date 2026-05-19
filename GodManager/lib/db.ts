import { PrismaClient, Prisma } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

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
