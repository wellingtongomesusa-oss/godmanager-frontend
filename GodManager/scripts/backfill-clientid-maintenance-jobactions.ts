/**
 * Idempotent backfill: set clientId on maintenance_calls / job_actions where NULL.
 *
 * Resolver do Client Manager Prop (prioridade):
 *   1) MANAGER_PROP_CLIENT_ID (variável de ambiente) — preferido em PROD se souber o id exato
 *   2) Client com companyName exatamente igual a 'Manager Prop' (igual scripts/f418-seed-permissions.ts)
 *   3) Fallback: primeiro Client cujo companyName contém 'Manager Prop' (case insensitive)
 *
 * CONFIRMADO no repo (não hardcodamos email até validação explícita em PROD):
 *   • O codebase usa sobretudo companyName: 'Manager Prop'.
 *   • O email tiago@managerproperties.com não aparece no repositório — confirme com o cliente
 *     antes de adicioná-lo aqui como critério.
 *
 * Usage:
 *   DATABASE_URL="..." npx tsx scripts/backfill-clientid-maintenance-jobactions.ts --dry-run
 *   DATABASE_URL="..." MANAGER_PROP_CLIENT_ID="..." npx tsx scripts/backfill-clientid-maintenance-jobactions.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const dryRun = process.argv.includes('--dry-run');

async function resolveManagerPropClientId(): Promise<string | null> {
  const envId = process.env.MANAGER_PROP_CLIENT_ID?.trim();
  if (envId) {
    console.log('[backfill] Using MANAGER_PROP_CLIENT_ID from env:', envId);
    return envId;
  }

  const exact = await prisma.client.findFirst({
    where: { companyName: 'Manager Prop' },
    select: { id: true, companyName: true },
  });
  if (exact) {
    console.log('[backfill] Matched Client by exact companyName "Manager Prop":', exact.id, exact.companyName);
    return exact.id;
  }

  const fuzzy = await prisma.client.findFirst({
    where: { companyName: { contains: 'Manager Prop', mode: 'insensitive' } },
    select: { id: true, companyName: true },
  });
  if (fuzzy) {
    console.warn(
      `[backfill] Matched Client by fuzzy name "${fuzzy.companyName}" (${fuzzy.id}) — revise se houver vários.`,
    );
    return fuzzy.id;
  }

  console.error(
    '[backfill] No Manager Prop client resolved. Set MANAGER_PROP_CLIENT_ID or fix company name in DB.',
  );
  return null;
}

async function main() {
  const clientId = await resolveManagerPropClientId();
  if (!clientId) {
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }

  const mcBefore = await prisma.maintenanceCall.count({
    where: { clientId: null },
  });
  const jaBefore = await prisma.jobAction.count({
    where: { clientId: null },
  });
  console.log('[backfill] maintenance_calls WHERE clientId IS NULL — count:', mcBefore);
  console.log('[backfill] job_actions WHERE clientId IS NULL — count:', jaBefore);

  if (dryRun) {
    console.log('[backfill] --dry-run: no writes performed.');
    await prisma.$disconnect();
    return;
  }

  const mcRes = await prisma.maintenanceCall.updateMany({
    where: { clientId: null },
    data: { clientId },
  });
  const jaRes = await prisma.jobAction.updateMany({
    where: { clientId: null },
    data: { clientId },
  });

  console.log('[backfill] maintenance_calls updated:', mcRes.count);
  console.log('[backfill] job_actions updated:', jaRes.count);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
