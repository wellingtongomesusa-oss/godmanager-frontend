/**
 * PRÉVIA (nao grava nada): le o General Ledger (CSV), classifica cada linha para o statement do
 * owner e mostra, por casa e por ciclo 15-a-15, credito/debito/net e o que fica para revisao.
 * Regra 15-a-15: monthRef = (dia >= 15) ? mes da data : mes anterior. Rotulo = mes de inicio.
 * Classificacao (confirmada):
 *   CREDITO (income): aluguel (Rent Income / meses / Online Payment / Prepaid Rent), Late Fee
 *   DEBITO (expense): Management Fee, House Cleaning, HOA, Lease Fee
 *   EXCLUIR: CC/EFT/Convenience fee, Security Deposit, transferencias, JE, reversoes
 *   REVISAO: demais pagamentos (Check/eCheck) — dependem do beneficiario (fornecedor vs repasse)
 * Uso: node scripts/gl-preview-15a15.mjs <csvPath> [--limit=20]
 */
import fs from 'fs';

const args = process.argv.slice(2);
const csvPath = args.find((a) => !a.startsWith('--'));
const limitArg = args.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : 20;
if (!csvPath) { console.error('Uso: node scripts/gl-preview-15a15.mjs <csvPath> [--limit=N]'); process.exit(1); }

function parseCsvLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else { if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; }
  }
  out.push(cur); return out;
}
const num = (s) => { const n = Number(String(s || '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : 0; };
function cycle15(mmddyyyy) {
  const m = String(mmddyyyy || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  let mo = parseInt(m[1], 10), day = parseInt(m[2], 10), yr = parseInt(m[3], 10);
  if (day < 15) { mo -= 1; if (mo < 1) { mo = 12; yr -= 1; } }
  return `${yr}-${String(mo).padStart(2, '0')}`;
}
const MONTHS = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/;
function classify(type, desc, debit, credit) {
  const t = String(type || '').toLowerCase(), d = String(desc || '').toLowerCase();
  if (/revers/.test(t)) return 'exclude';
  if (t === 'je' || t === 'bank transfer' || t === 'checksend') return 'exclude';
  if (/cc fee|eft fee|convenience fee/.test(d)) return 'exclude';
  if (/security deposit|held security/.test(d)) return 'exclude';
  if (/transfer/.test(d)) return 'exclude';
  if (debit > 0) {
    if (/rent income|prepaid rent|online payment|move in charge: rent/.test(d) || MONTHS.test(d) || /late fee/.test(d)) return 'income';
    return 'review';
  }
  if (credit > 0) {
    if (/management fee|house cleaning|hoa|lease fee/.test(d)) return 'expense';
    return 'review';
  }
  return 'exclude';
}

const raw = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/);
const agg = new Map();
const tot = { income: 0, expense: 0, review: 0, exclude: 0 };
for (const line of raw) {
  if (!line.trim()) continue;
  const f = parseCsvLine(line);
  const prop = (f[0] || '').trim();
  if (!prop || prop === 'Property' || prop === 'Starting Balance' || prop === 'Total' || prop.startsWith('->')) continue;
  const ym = cycle15((f[1] || '').trim());
  if (!ym) continue;
  const debit = num(f[5]); const credit = num(f[6]);
  if (debit === 0 && credit === 0) continue;
  const cls = classify(f[3], f[8], debit, credit);
  const amt = debit > 0 ? debit : credit;
  tot[cls] += amt;
  const key = prop + '||' + ym;
  const a = agg.get(key) || { prop, ym, income: 0, expense: 0, review: 0 };
  if (cls === 'income') a.income += debit;
  else if (cls === 'expense') a.expense += credit;
  else if (cls === 'review') a.review += amt;
  agg.set(key, a);
}

const list = Array.from(agg.values()).sort((x, y) => (x.ym === y.ym ? x.prop.localeCompare(y.prop) : x.ym.localeCompare(y.ym)));
const byCycle = new Map();
for (const a of list) { const c = byCycle.get(a.ym) || { inc: 0, exp: 0, rev: 0, houses: new Set() }; c.inc += a.income; c.exp += a.expense; c.rev += a.review; c.houses.add(a.prop); byCycle.set(a.ym, c); }

console.log('=== Classificacao GERAL (todas as linhas) ===');
console.log(`  Credito (income):  $${tot.income.toFixed(2)}`);
console.log(`  Debito (expense):  $${tot.expense.toFixed(2)}`);
console.log(`  Revisao (payee?):  $${tot.review.toFixed(2)}`);
console.log(`  Excluido:          $${tot.exclude.toFixed(2)}`);
console.log('\n=== Por ciclo 15-a-15 (net = credito - debito) ===');
for (const [ym, c] of Array.from(byCycle.entries()).sort()) {
  console.log(`  ${ym}: ${c.houses.size} casas | credito $${c.inc.toFixed(2)} | debito $${c.exp.toFixed(2)} | net $${(c.inc - c.exp).toFixed(2)} | revisao $${c.rev.toFixed(2)}`);
}
console.log(`\n=== Amostra casa/ciclo 2026-06 (primeiras ${LIMIT}) ===`);
for (const a of list.filter((x) => x.ym === '2026-06').slice(0, LIMIT)) {
  console.log(`  ${a.prop.slice(0, 44).padEnd(44)} | cred $${a.income.toFixed(2)} | deb $${a.expense.toFixed(2)} | net $${(a.income - a.expense).toFixed(2)}${a.review ? ' | revisao $' + a.review.toFixed(2) : ''}`);
}
console.log('\n(PREVIA — nada foi gravado.)');
