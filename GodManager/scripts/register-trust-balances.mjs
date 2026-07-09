#!/usr/bin/env node
/**
 * Registra os saldos mensais das 3 contas Trust (Chase / MANAGER PROP LLC) extraídos
 * dos extratos (Jan–Jun 2026) no modelo BankAccountBalance — alimenta a tela Statement.
 *
 * Idempotente: se já existir saldo com (clientId, accountType, balanceDate) igual, PULA
 * (não duplica). Mostra o que faria em DRY-RUN.
 *
 * Uso:
 *   node scripts/register-trust-balances.mjs --prod            (DRY-RUN)
 *   node scripts/register-trust-balances.mjs --prod --apply    (grava)
 *   node scripts/register-trust-balances.mjs --prod --client=<clientId>   (força o cliente)
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--apply');
const USE_PROD = process.argv.includes('--prod');
const clientArg = (process.argv.find((a) => a.startsWith('--client=')) || '').split('=')[1] || '';

// ── Mapeamento final da conta → tipo (RECOMENDAÇÃO — ajuste aqui se precisar) ──
const ACCOUNT_MAP = {
  '7236': 'TRUST_CHASE', // oscila $36k–$92k, origem de repasses
  '6352': 'OPERATING_TRUST', // saldo acumulando de ~zero
  '7509': 'DEPOSIT_SECURITY', // cresce monotônico $160k→$231k (caução)
};

// ── Saldos FINAIS por data de extrato (extraídos dos PDFs Chase) ──
// balanceDate = data de fechamento do extrato
const BALANCES = [
  { date: '2026-01-30', '6352': 5946.21, '7236': 36526.66, '7509': 160020.0 },
  { date: '2026-02-27', '6352': 33575.71, '7236': 59783.95, '7509': 166529.6 },
  { date: '2026-03-31', '6352': 42564.67, '7236': 56805.37, '7509': 193890.01 },
  { date: '2026-04-30', '6352': 33378.09, '7236': 92058.94, '7509': 206825.55 },
  { date: '2026-05-29', '6352': 71471.64, '7236': 77832.27, '7509': 227990.66 },
  { date: '2026-06-30', '6352': 111726.12, '7236': 70296.56, '7509': 231078.97 },
];

function envVar(name) {
  try {
    for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
      const m = line.match(new RegExp('^' + name + '=("?)(.+?)\\1\\s*$'));
      if (m) return m[2];
    }
  } catch {}
  return null;
}

const dbUrl = USE_PROD ? envVar('DATABASE_URL_PRODUCTION') : envVar('DATABASE_URL_LOCAL');
if (!dbUrl) {
  console.error('DATABASE_URL não encontrada (.env.local, use --prod).');
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

async function resolveClientId() {
  if (clientArg) return clientArg;
  // acha o cliente "Manager Prop"
  const clients = await prisma.client.findMany({
    where: { companyName: { contains: 'Manager Prop', mode: 'insensitive' } },
    select: { id: true, companyName: true },
  });
  if (clients.length === 1) return clients[0].id;
  if (clients.length === 0) {
    console.error('Nenhum cliente "Manager Prop" encontrado. Passe --client=<id>.');
    console.error('Clientes disponíveis:');
    const all = await prisma.client.findMany({ select: { id: true, companyName: true } });
    all.forEach((c) => console.error(`  ${c.id}  ${c.companyName}`));
    return null;
  }
  console.error('Vários clientes "Manager Prop" — desambigue com --client=<id>:');
  clients.forEach((c) => console.error(`  ${c.id}  ${c.companyName}`));
  return null;
}

async function main() {
  console.log(`[register-trust-balances] modo=${APPLY ? 'APPLY' : 'DRY-RUN'} db=${USE_PROD ? 'PROD' : 'LOCAL'}`);
  console.log('Mapeamento:', JSON.stringify(ACCOUNT_MAP));
  const clientId = await resolveClientId();
  if (!clientId) {
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log(`Cliente: ${clientId}`);

  let planned = 0;
  let skipped = 0;
  for (const row of BALANCES) {
    const balanceDate = new Date(row.date + 'T00:00:00.000Z');
    for (const last4 of Object.keys(ACCOUNT_MAP)) {
      const accountType = ACCOUNT_MAP[last4];
      const balance = row[last4];
      const existing = await prisma.bankAccountBalance.findFirst({
        where: { clientId, accountType, balanceDate },
        select: { id: true, balance: true },
      });
      if (existing) {
        skipped++;
        console.log(`  = ${row.date} ${accountType} (${last4}) já existe ($${Number(existing.balance).toFixed(2)}) — pula`);
        continue;
      }
      planned++;
      console.log(`  ${APPLY ? '+' : '~'} ${row.date} ${accountType} (${last4}) = $${balance.toFixed(2)}`);
      if (APPLY) {
        await prisma.bankAccountBalance.create({
          data: { clientId, accountType, balance: balance.toFixed(2), balanceDate, recordedBy: null },
        });
      }
    }
  }

  console.log(`\n[resultado] ${APPLY ? 'gravados' : 'seriam gravados'}: ${planned} | já existiam (pulados): ${skipped}`);
  if (!APPLY) console.log('DRY-RUN — nada gravado. Rode com --apply para gravar.');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
