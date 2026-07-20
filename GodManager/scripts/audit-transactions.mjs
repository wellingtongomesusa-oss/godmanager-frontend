/**
 * Motor de auditoria (trust accounting / FREC) sobre o QuickBooks "Transaction List by Date".
 * SÓ LÊ O CSV — nao usa banco de dados. Aplica os achados detectaveis e emite 3 secoes:
 *   (1) resumo conforme  (2) exigem correcao/repasse  (3) ambiguos p/ confirmacao humana
 * Uso: node scripts/audit-transactions.mjs "<csvPath>"
 */
import fs from 'fs';

const csvPath = process.argv[2];
if (!csvPath) { console.error('Uso: node scripts/audit-transactions.mjs "<csvPath>"'); process.exit(1); }

// Parser de CSV que respeita campos multi-linha entre aspas (o memo do QuickBooks tem \n).
function parseCsv(text) {
  const records = []; let field = '', record = [], q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { record.push(field); field = ''; }
      else if (c === '\r') { /* ignora */ }
      else if (c === '\n') { record.push(field); records.push(record); field = ''; record = []; }
      else field += c;
    }
  }
  if (field.length || record.length) { record.push(field); records.push(record); }
  return records;
}
const num = (s) => { const n = Number(String(s || '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : 0; };
const money = (n) => '$' + Number(n || 0).toFixed(2);

const records = parseCsv(fs.readFileSync(csvPath, 'utf8'));
const rows = [];
for (const f of records) {
  if (!f[0] || !/^\d{2}\/\d{2}\/\d{4}$/.test(String(f[0]).trim())) continue;
  rows.push({
    date: f[0].trim(), type: (f[1] || '').trim(), numRaw: (f[2] || '').trim(),
    posting: (f[3] || '').trim(), name: (f[4] || '').trim(), memo: (f[5] || '').trim(),
    account: (f[6] || '').trim(), split: (f[7] || '').trim(),
    amount: num(f[8]), debit: num(f[9]), credit: num(f[10]),
  });
}

// Sinais fortes de veiculo (evita falsos-positivos como "lease renewal" e registro empresarial).
const VEHICLE = /\b(vehicle expense|auto expense|car tag|car tags|license plate|\bdmv\b|sunpass|e-?zpass|smog check|emission test|oil change|car wash|\bseguro carro\b|placa do carro)\b/i;
const TELECOM = /telephone|internet|t-?mobile|software|subscription/i;
const AUTO_ACCT = /auto/i;
const HOA_ACCT = /hoa/i;
const SECDEP = /security deposit|held security|escrow/i;
const FEE_ACCT = /management income|management fee|placement fee|leasing fee|tenant placement/i;

const need = []; // secao 2
const ambig = []; // secao 3
const conform = { count: 0 };

// R3: transferencias duplicadas
for (const r of rows) {
  if (/duplicate transfer|duplicate deposit|dup(licate)? sync/i.test(r.memo)) {
    need.push({ rule: 'Depósito duplicado', date: r.date, name: r.name, acct: r.account, amount: r.amount, why: 'memo indica duplicidade — exige estorno confirmado', memo: r.memo.slice(0, 80) });
  }
}
// R2: despesa de veiculo em conta errada
for (const r of rows) {
  const blob = r.name + ' ' + r.memo + ' ' + r.split + ' ' + r.account;
  const isVehicle = VEHICLE.test(blob);
  const inAuto = AUTO_ACCT.test(r.account) || AUTO_ACCT.test(r.split) || /vehicle expense/i.test(r.split);
  if (isVehicle && !inAuto && !TELECOM.test(r.account + ' ' + r.split)) {
    const bucket = HOA_ACCT.test(r.account + ' ' + r.split) ? need : ambig;
    bucket.push({ rule: 'Veículo em conta errada', date: r.date, name: r.name, acct: r.account + (r.split ? ' / ' + r.split : ''), amount: r.amount, why: 'parece despesa de veículo fora de "Auto Expense"' + (HOA_ACCT.test(r.account + ' ' + r.split) ? ' (está em HOA)' : ''), memo: r.memo.slice(0, 60) });
  }
}
// R7: reconhecimento de receita por competencia — fee (management/placement) lançado muito
// depois do mes de servico referido no memo/nome. Vai para "ambiguos" (confirmacao humana).
const MONTHS_MAP = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };
const FEE = /management (income|fee)|placement fee|leasing fee|lease renewal fee|4100|4150|4140/i;
for (const r of rows) {
  if (!FEE.test(r.account + ' ' + r.split)) continue;
  const dm = r.date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (!dm) continue;
  const txn = new Date(Number(dm[3]), Number(dm[1]) - 1, Number(dm[2]));
  const mm = (r.memo + ' ' + r.name).toLowerCase().match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/);
  if (!mm) continue;
  let refYear = txn.getFullYear();
  const refMonth = MONTHS_MAP[mm[1]];
  // se o mes referido e maior que o mes da transacao, provavelmente e do ano anterior
  if (refMonth > txn.getMonth()) refYear -= 1;
  const refEnd = new Date(refYear, refMonth + 1, 0); // ultimo dia do mes de servico
  const days = Math.round((txn - refEnd) / 86400000);
  if (days > 30) {
    ambig.push({ rule: 'Atraso de reconhecimento de receita', date: r.date, name: r.name, acct: (r.account || r.split).slice(0, 40), amount: r.amount || r.debit || r.credit, why: `fee de ${mm[1]} lançado ${days} dias após o mês de competência` });
  }
}
// R5: caução — casar reembolsos (saida) com retencoes (entrada) por nome
const depByName = new Map(), refByName = new Map();
for (const r of rows) {
  if (!SECDEP.test(r.account + ' ' + r.memo + ' ' + r.split)) continue;
  const key = r.name.toLowerCase().trim() || '(sem nome)';
  if (r.debit > 0 || /receipt|deposit|charge/i.test(r.type)) { const a = depByName.get(key) || 0; depByName.set(key, a + (r.debit || r.amount)); }
  if (r.credit > 0 || /refund|payment|check|expense/i.test(r.type)) { const a = refByName.get(key) || 0; refByName.set(key, a + (r.credit || Math.abs(r.amount))); }
}
for (const [key, ref] of refByName) {
  const dep = depByName.get(key) || 0;
  if (Math.abs(ref - dep) > 0.01) {
    ambig.push({ rule: 'Descasamento de caução', date: '', name: key, acct: 'Security Deposit', amount: ref - dep, why: `reembolso ${money(ref)} vs retido ${money(dep)} — diferença ${money(ref - dep)}` });
  }
}
// R6: numeracao de invoice — lacunas + Voided. So a serie "Invoice" (Charges nao sao sequenciais).
const nums = rows.filter((r) => /^invoice$/i.test(r.type) && /^\d+$/.test(r.numRaw)).map((r) => parseInt(r.numRaw, 10));
const voided = rows.filter((r) => /void/i.test(r.type) || /void/i.test(r.memo));
let gaps = [];
if (nums.length) {
  const set = new Set(nums); const min = Math.min(...nums), max = Math.max(...nums);
  for (let n = min; n <= max; n++) if (!set.has(n)) gaps.push(n);
}

conform.count = rows.length - need.length - ambig.length;

console.log(`=== AUDITORIA — ${rows.length} transacoes (${csvPath.split('/').pop()}) ===\n`);
console.log(`[1] CONFORMES (sem acao): ~${conform.count} lançamentos.\n`);

console.log(`[2] EXIGEM CORRECAO / REPASSE (${need.length}):`);
if (!need.length) console.log('   (nenhum detectado nas regras automaticas)');
for (const x of need.slice(0, 40)) console.log(`   - ${x.rule} | ${x.date} | ${x.name} | ${money(x.amount)} | ${x.acct} | ${x.why}${x.memo ? ' | memo: ' + x.memo : ''}`);
if (need.length > 40) console.log(`   ... +${need.length - 40}`);

console.log(`\n[3] AMBIGUOS — confirmacao humana (${ambig.length}):`);
if (!ambig.length) console.log('   (nenhum)');
for (const x of ambig.slice(0, 40)) console.log(`   - ${x.rule} | ${x.date} | ${x.name} | ${money(x.amount)} | ${x.acct} | ${x.why}`);
if (ambig.length > 40) console.log(`   ... +${ambig.length - 40}`);

console.log(`\n[Invoices] numerados: ${nums.length} | Voided: ${voided.length} | lacunas de numeracao: ${gaps.length}${gaps.length ? ' -> ' + gaps.slice(0, 20).join(', ') + (gaps.length > 20 ? '...' : '') : ''}`);
for (const v of voided.slice(0, 10)) console.log(`   Voided: ${v.date} | #${v.numRaw} | ${v.name} | ${money(v.amount)}`);
