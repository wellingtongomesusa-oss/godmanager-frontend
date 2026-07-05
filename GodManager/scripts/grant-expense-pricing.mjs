#!/usr/bin/env node
/**
 * Concede a permissão 'expense_pricing' (decidir preços no Expenses / botão MGR)
 * aos usuários indicados. Idempotente (não duplica a flag).
 *
 * Uso:
 *   node scripts/grant-expense-pricing.mjs --prod           (DRY-RUN)
 *   node scripts/grant-expense-pricing.mjs --prod --apply
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const APPLY = process.argv.includes('--apply');
const USE_PROD = process.argv.includes('--prod');

// Lucas Coelho (coelho@coelho.com), Henrique, Samuel, Ocimar.
const EMAILS = ['coelho@coelho.com', 'info@managerprop.com', 'samuel@samuel.com', 'ocimar@master.com'];
const FLAG = 'expense_pricing';

function envFromDotLocal(varName) {
  try {
    const raw = readFileSync(join(ROOT, '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(new RegExp('^' + varName + '=("?)(.+?)\\1\\s*$'));
      if (m) return m[2];
    }
  } catch {
    /* sem .env.local */
  }
  return null;
}

const dbUrl = USE_PROD
  ? envFromDotLocal('DATABASE_URL_PRODUCTION')
  : envFromDotLocal('DATABASE_URL_LOCAL');
if (!dbUrl) {
  console.error('DATABASE_URL não encontrada em .env.local (use --prod).');
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

async function main() {
  console.log(`[grant-expense-pricing] modo=${APPLY ? 'APPLY' : 'DRY-RUN'} db=${USE_PROD ? 'PROD' : 'LOCAL'}`);
  for (const email of EMAILS) {
    const user = await prisma.user.findFirst({
      where: { email },
      select: { id: true, email: true, permissions: true },
    });
    if (!user) {
      console.log(`  [${email}] NÃO ENCONTRADO`);
      continue;
    }
    const perms = Array.isArray(user.permissions) ? user.permissions : [];
    if (perms.includes(FLAG)) {
      console.log(`  [${email}] já tem '${FLAG}'`);
      continue;
    }
    console.log(`  [${email}] ${APPLY ? 'concedendo' : 'concederia'} '${FLAG}'`);
    if (APPLY) {
      await prisma.user.update({
        where: { id: user.id },
        data: { permissions: { set: [...perms, FLAG] } },
      });
    }
  }
  console.log(APPLY ? '[resultado] APLICADO' : '[resultado] dry-run — nada gravado');
  await prisma.$disconnect();
}
main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
