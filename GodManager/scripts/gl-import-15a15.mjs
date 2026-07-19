/**
 * Importa o General Ledger (CSV) para os statements individuais, por casa e ciclo 15-a-15.
 *
 * Regra 15-a-15: monthRef = (dia >= 15) ? mes da data : mes anterior. Rotulo = mes de inicio.
 * Classificacao:
 *   CREDITO (income):  aluguel (Rent Income / meses / Online Payment / Prepaid Rent), Late Fee
 *   DEBITO (expense):  Management Fee, House Cleaning, HOA, Lease Fee, e pagamentos a FORNECEDOR
 *   EXCLUIR:           CC/EFT/Convenience fee, Security Deposit, transferencias, JE, reversoes,
 *                      e pagamentos cujo Payee e um OWNER (repasse, nao e despesa)
 *   REVISAO:           pagamentos cujo Payee nao casou com owner nem vendor (nao lança; reporta)
 *
 * Idempotente: cada linha do GL vira uma line-item com source=CSV_UPLOAD e sourceRefId estavel
 * (hash de data+valor+ref+descricao). Reexecutar nao duplica. Pula statements fechados.
 *
 * Uso:
 *   node scripts/gl-import-15a15.mjs <csvPath> <clientId> [--apply]
 *   (sem --apply = PREVIA: nao grava nada)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import fs from 'fs';
import crypto from 'crypto';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const pos = args.filter((a) => !a.startsWith('--'));
const csvPath = pos[0];
const clientId = pos[1];
if (!csvPath || !clientId) {
  console.error('Uso: node scripts/gl-import-15a15.mjs <csvPath> <clientId> [--apply]');
  process.exit(1);
}

const prisma = new PrismaClient();

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
const norm = (s) => String(s || '').toLowerCase().replace(/#/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
function cycle15(mmddyyyy) {
  const m = String(mmddyyyy || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  let mo = parseInt(m[1], 10), day = parseInt(m[2], 10), yr = parseInt(m[3], 10);
  if (day < 15) { mo -= 1; if (mo < 1) { mo = 12; yr -= 1; } }
  return `${yr}-${String(mo).padStart(2, '0')}`;
}
function isoDate(mmddyyyy) {
  const m = String(mmddyyyy || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
}
const MONTHS = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/;
function nameMatches(payeeNorm, set) {
  if (!payeeNorm) return false;
  if (set.has(payeeNorm)) return true;
  for (const n of set) {
    if (!n) continue;
    if (payeeNorm.includes(n) || n.includes(payeeNorm)) return true;
  }
  return false;
}

const [properties, owners, vendors] = await Promise.all([
  prisma.property.findMany({ where: { clientId }, select: { id: true, code: true, address: true, clientId: true } }),
  prisma.owner.findMany({ where: { clientId }, select: { name: true } }),
  prisma.pmVendor.findMany({ where: { clientId }, select: { companyName: true } }),
]);
const ownerSet = new Set(owners.map((o) => norm(o.name)).filter(Boolean));
const vendorSet = new Set(vendors.map((v) => norm(v.companyName)).filter(Boolean));
// index de casas por endereco normalizado (usa o maior; match por contains)
const propIndex = properties.map((p) => ({ p, key: norm(p.address) })).filter((x) => x.key);

function matchProperty(glProp) {
  const g = norm(glProp);
  let best = null, bestLen = 0;
  for (const { p, key } of propIndex) {
    if ((g.includes(key) || key.includes(g)) && key.length > bestLen) { best = p; bestLen = key.length; }
  }
  return best;
}

function classify(type, desc, debit, credit, payeeNorm) {
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
    if (nameMatches(payeeNorm, ownerSet)) return 'exclude';   // repasse ao owner
    if (nameMatches(payeeNorm, vendorSet)) return 'expense';   // pagamento a fornecedor
    return 'review';                                           // payee nao identificado
  }
  return 'exclude';
}

const raw = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/);
const perHouse = new Map(); // propId||ym -> {code, income, expense}
const items = [];           // linhas a gravar
const stat = { income: 0, expense: 0, excludeC: 0, review: 0, noProp: 0, rows: 0 };

for (const line of raw) {
  if (!line.trim()) continue;
  const f = parseCsvLine(line);
  const prop = (f[0] || '').trim();
  if (!prop || prop === 'Property' || prop === 'Starting Balance' || prop === 'Total' || prop.startsWith('->')) continue;
  const ym = cycle15((f[1] || '').trim());
  if (!ym) continue;
  const debit = num(f[5]); const credit = num(f[6]);
  if (debit === 0 && credit === 0) continue;
  stat.rows++;
  const payeeNorm = norm(f[2]);
  const cls = classify(f[3], f[8], debit, credit, payeeNorm);
  if (cls === 'exclude') { stat.excludeC++; continue; }
  if (cls === 'review') { stat.review++; continue; }
  const pm = matchProperty(prop);
  if (!pm) { stat.noProp++; continue; }
  const amount = cls === 'income' ? debit : credit;
  const desc = (f[8] || '').trim() || (cls === 'income' ? 'Pagamento recebido' : 'Pagamento enviado');
  const ref = crypto.createHash('sha1').update([f[1], f[2], f[4], f[8], debit, credit].join('|')).digest('hex').slice(0, 24);
  items.push({ propId: pm.id, code: pm.code, ym, lineType: cls === 'income' ? 'income' : 'expense', amount, desc: desc.slice(0, 300), date: isoDate(f[1]), sourceRefId: 'gl:' + ref });
  if (cls === 'income') stat.income += amount; else stat.expense += amount;
  const k = pm.id + '||' + ym;
  const a = perHouse.get(k) || { code: pm.code, income: 0, expense: 0 };
  if (cls === 'income') a.income += amount; else a.expense += amount;
  perHouse.set(k, a);
}

console.log(`Casas na empresa: ${properties.length} | owners: ${owners.length} | vendors: ${vendors.length}`);
console.log(`Linhas de transacao: ${stat.rows}`);
console.log(`  -> a lançar: income $${stat.income.toFixed(2)} | expense $${stat.expense.toFixed(2)} (${items.length} linhas)`);
console.log(`  -> excluidas: ${stat.excludeC} | em revisao (payee?): ${stat.review} | sem casa casada: ${stat.noProp}`);

const cyc = new Map();
for (const [k, a] of perHouse) { const ym = k.split('||')[1]; const c = cyc.get(ym) || { inc: 0, exp: 0, n: 0 }; c.inc += a.income; c.exp += a.expense; c.n++; cyc.set(ym, c); }
console.log('\n=== Por ciclo (a lançar) ===');
for (const [ym, c] of Array.from(cyc.entries()).sort()) {
  console.log(`  ${ym}: ${c.n} casas | credito $${c.inc.toFixed(2)} | debito $${c.exp.toFixed(2)} | net $${(c.inc - c.exp).toFixed(2)}`);
}

if (!apply) {
  console.log('\n== PREVIA (nada gravado). Use --apply para gravar. ==');
  await prisma.$disconnect();
  process.exit(0);
}

console.log('\n== APLICANDO ==');
let posted = 0, dup = 0, closed = 0, fail = 0;
const payoutCache = new Map();
for (const it of items) {
  try {
    let payout = payoutCache.get(it.propId + '||' + it.ym);
    if (payout === undefined) {
      payout = await prisma.ownerMonthPayout.findUnique({ where: { propertyId_yearMonth: { propertyId: it.propId, yearMonth: it.ym } }, select: { id: true, closedAt: true } });
      payoutCache.set(it.propId + '||' + it.ym, payout || null);
    }
    if (payout && payout.closedAt) { closed++; continue; }
    const pid = payout ? payout.id : (await prisma.ownerMonthPayout.create({ data: { propertyId: it.propId, yearMonth: it.ym, clientId, totalIncome: new Prisma.Decimal(0), totalExpenses: new Prisma.Decimal(0), netPayout: new Prisma.Decimal(0) }, select: { id: true } })).id;
    if (!payout) payoutCache.set(it.propId + '||' + it.ym, { id: pid, closedAt: null });
    await prisma.statementLineItem.create({
      data: {
        ownerMonthPayoutId: pid, lineType: it.lineType, description: it.desc,
        amount: new Prisma.Decimal(it.amount), sortOrder: it.lineType === 'income' ? 5 : 25, clientId,
        source: 'CSV_UPLOAD', sourceRefId: it.sourceRefId,
        transactionDate: it.date ? new Date(it.date + 'T12:00:00.000Z') : null,
        approvedAt: new Date(), approvedBy: 'system:gl-15a15',
      },
    });
    posted++;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') dup++;
    else { fail++; if (fail <= 5) console.log('  falha:', e.message); }
  }
}
// recomputa totais dos payouts afetados (inline; Node nao importa .ts)
async function recompute(pid) {
  const rows = await prisma.statementLineItem.findMany({ where: { ownerMonthPayoutId: pid }, select: { lineType: true, amount: true } });
  let inc = new Prisma.Decimal(0), exp = new Prisma.Decimal(0);
  for (const r of rows) { if (r.lineType === 'income') inc = inc.add(r.amount); else if (r.lineType === 'expense') exp = exp.add(r.amount); }
  await prisma.ownerMonthPayout.update({ where: { id: pid }, data: { totalIncome: inc, totalExpenses: exp, netPayout: inc.sub(exp) } });
}
const seenPayouts = new Set();
for (const [, po] of payoutCache) { if (po && po.id && !seenPayouts.has(po.id)) { seenPayouts.add(po.id); try { await recompute(po.id); } catch { } } }
console.log(`\nResultado: lançadas ${posted} | ja existiam ${dup} | fechadas ${closed} | falhas ${fail}`);
await prisma.$disconnect();
