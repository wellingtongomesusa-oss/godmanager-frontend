/**
 * Valida o parser de extratos Chase (#39). Uso:
 *   npx tsx scripts/parse-chase-statements.ts <arquivo.pdf | pasta> [--csv <destino>]
 * Extrai o texto com `pdftotext -layout`, roda parseChaseStatement e imprime a validação de saldos.
 * SOMENTE LEITURA — não grava no banco. (A carga na conciliação vem depois, endpoint/scripts próprios.)
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseChaseStatement } from '../lib/chaseStatementParser';

function pdfToText(pdfPath: string): string {
  return execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const arg = process.argv[2];
if (!arg) {
  console.error('Uso: tsx scripts/parse-chase-statements.ts <arquivo.pdf | pasta>');
  process.exit(1);
}

let files: string[] = [];
const stat = fs.statSync(arg);
if (stat.isDirectory()) {
  files = fs
    .readdirSync(arg)
    .filter((f) => /-statements-\d+-.*\.pdf$/i.test(f) && !/\(\d\)/.test(f))
    .map((f) => path.join(arg, f))
    .sort();
} else {
  files = [arg];
}

let totalAccounts = 0;
let balancedAccounts = 0;

for (const file of files) {
  let text: string;
  try {
    text = pdfToText(file);
  } catch (e) {
    console.log(`\n✗ ${path.basename(file)} — falha no pdftotext: ${e instanceof Error ? e.message : e}`);
    continue;
  }
  const st = parseChaseStatement(text);
  console.log(`\n=== ${path.basename(file)}  |  período ${st.periodStart} → ${st.periodEnd}  (${st.periodMonth}) ===`);
  if (!st.accounts.length) {
    console.log('  (nenhuma conta detectada)');
    continue;
  }
  for (const a of st.accounts) {
    totalAccounts++;
    if (a.balanced) balancedAccounts++;
    const flag = a.balanced ? 'OK ' : 'ERRO';
    console.log(
      `  [${flag}] conta …${a.last4}  ini ${fmt(a.beginningBalance)}  +cred ${fmt(a.totalCredits)}  -deb ${fmt(a.totalDebits)}  = calc ${fmt(a.computedEnding)}  vs fim ${fmt(a.endingBalance)}  (dif ${fmt(a.diff)})  · ${a.transactions.length} txns`,
    );
  }
}

console.log(`\n--- Resumo: ${balancedAccounts}/${totalAccounts} contas com saldo batendo ---`);
process.exit(balancedAccounts === totalAccounts ? 0 : 2);
