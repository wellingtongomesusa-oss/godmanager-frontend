/**
 * Importa os extratos Chase (#39) para a Conciliação Bancária do GodManager.
 * Para cada conta/mês: upsert de BankReconciliation com openingBalance (saldo inicial do banco) e
 * statementBalance (saldo final do banco). Idempotente (upsert). Exporta também as transações em CSV.
 *
 * Uso:
 *   npx tsx scripts/import-chase-to-reconciliation.ts <pastaPDFs> <clientId> [--apply] [--csv <dir>]
 * Sem --apply = DRY-RUN (não grava nada). Precisa de DATABASE_URL (banco de produção) para --apply.
 *
 * Mapa das contas (confirmado por Wellington): 6352=OPERATING_TRUST, 7236=TRUST_CHASE, 7509=DEPOSIT_SECURITY.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { parseChaseStatement, type ChaseAccount } from '../lib/chaseStatementParser';

const ACCOUNT_KEY_BY_LAST4: Record<string, string> = {
  '6352': 'OPERATING_TRUST',
  '7236': 'TRUST_CHASE',
  '7509': 'DEPOSIT_SECURITY',
};

// Coleta argumentos posicionais (ignora flags e o valor de --csv).
const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const csvIdx = argv.indexOf('--csv');
const csvDir = csvIdx >= 0 ? argv[csvIdx + 1] : null;
const positionals = argv.filter((a, i) => !a.startsWith('--') && !(csvIdx >= 0 && i === csvIdx + 1));
const dir = positionals[0];
let clientId = positionals[1] || ''; // opcional: se vazio, busca a Manager Prop pelo nome

if (!dir) {
  console.error('Uso: tsx scripts/import-chase-to-reconciliation.ts <pastaPDFs> [clientId] [--apply] [--csv <dir>]');
  process.exit(1);
}

function pdfToText(p: string): string {
  return execFileSync('pdftotext', ['-layout', p, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}
const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const csvCell = (v: string | number) => {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

// Um PDF por mês (dedupe: usa o arquivo da conta 6352, que já traz as 3 contas consolidadas; ignora cópias "(n)").
const files = fs
  .readdirSync(dir)
  .filter((f) => /-statements-6352-\.pdf$/i.test(f) && !/\(\d\)/.test(f))
  .map((f) => path.join(dir, f))
  .sort();

if (!files.length) {
  console.error(`Nenhum extrato ...-statements-6352-.pdf em ${dir}`);
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: { db: { url: (process.env.DATABASE_URL || '') + '?connection_limit=3&pool_timeout=15' } },
});
const cleanup = async () => { try { await prisma.$disconnect(); } catch { /* noop */ } };
process.on('beforeExit', cleanup);
process.on('SIGINT', async () => { await cleanup(); process.exit(130); });

type Row = { periodMonth: string; account: ChaseAccount; key: string };

async function resolveClientId(): Promise<string> {
  if (clientId) {
    const c = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, companyName: true } });
    if (!c) { console.error(`Cliente ${clientId} não encontrado.`); process.exit(1); }
    console.log(`Cliente: ${c.companyName} (${c.id})`);
    return c.id;
  }
  const matches = await prisma.client.findMany({
    where: { companyName: { contains: 'Manager Prop', mode: 'insensitive' } },
    select: { id: true, companyName: true },
  });
  if (matches.length === 1) {
    console.log(`Cliente encontrado automaticamente: ${matches[0].companyName} (${matches[0].id})`);
    return matches[0].id;
  }
  if (matches.length === 0) {
    console.error('Nenhum cliente "Manager Prop" encontrado. Passe o clientId manualmente.');
    process.exit(1);
  }
  console.error('Vários clientes "Manager Prop" — passe o clientId. Opções:');
  for (const m of matches) console.error(`  ${m.id}  ${m.companyName}`);
  process.exit(1);
}

async function main() {
  clientId = await resolveClientId();
  const rows: Row[] = [];
  for (const file of files) {
    const st = parseChaseStatement(pdfToText(file));
    if (!st.periodMonth) { console.log(`✗ ${path.basename(file)}: período não detectado`); continue; }
    for (const account of st.accounts) {
      const key = ACCOUNT_KEY_BY_LAST4[account.last4];
      if (!key) { console.log(`  ? conta …${account.last4} sem mapa — pulada`); continue; }
      rows.push({ periodMonth: st.periodMonth, account, key });
    }
  }

  console.log(`\n${apply ? 'APLICANDO' : 'DRY-RUN'} — ${rows.length} conta/mês · client ${clientId}\n`);
  let ok = 0, bad = 0;
  for (const r of rows) {
    const a = r.account;
    const status = a.balanced ? 'OK ' : 'ERRO(saldo!)';
    console.log(`  [${status}] ${r.periodMonth} ${r.key} (…${a.last4})  ini ${fmt(a.beginningBalance)}  fim ${fmt(a.endingBalance)}  · ${a.transactions.length} txns`);
    if (!a.balanced) { bad++; continue; }
    ok++;

    if (csvDir) {
      fs.mkdirSync(csvDir, { recursive: true });
      const lines = ['Data,Descricao,Valor,Tipo,Secao'];
      for (const t of a.transactions) {
        lines.push([t.date, csvCell(t.description), t.amount.toFixed(2), t.amount >= 0 ? 'CREDITO' : 'DEBITO', t.section].join(','));
      }
      fs.writeFileSync(path.join(csvDir, `${r.periodMonth}_${r.key}_${a.last4}.csv`), '﻿' + lines.join('\r\n') + '\r\n');
    }

    if (apply) {
      await prisma.bankReconciliation.upsert({
        where: { clientId_bankAccountKey_periodMonth: { clientId, bankAccountKey: r.key, periodMonth: r.periodMonth } },
        create: {
          clientId, bankAccountKey: r.key, periodMonth: r.periodMonth,
          openingBalance: a.beginningBalance, statementBalance: a.endingBalance,
          notes: `Importado do extrato Chase (conta …${a.last4}).`,
        },
        update: { openingBalance: a.beginningBalance, statementBalance: a.endingBalance },
      });
    }
  }

  console.log(`\n--- ${ok} conta/mês ${apply ? 'gravadas' : 'prontas'}; ${bad} com saldo divergente (não gravadas). ${csvDir ? `CSVs em ${csvDir}` : ''} ---`);
  if (!apply) console.log('(dry-run — rode com --apply e DATABASE_URL de produção para gravar)');
  await cleanup();
}

main().catch(async (e) => { console.error(e); await cleanup(); process.exit(1); });
