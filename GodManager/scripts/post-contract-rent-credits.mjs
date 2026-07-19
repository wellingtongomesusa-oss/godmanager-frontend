/**
 * Lança o ALUGUEL DO CONTRATO como crédito (primeira linha) no statement das casas que NÃO
 * estão na lista de inadimplentes (CSV de delinquency). As casas devedoras do CSV ficam de fora.
 *
 * Segurança:
 *  - DRY-RUN por padrão: apenas mostra o que faria. Use --apply para gravar.
 *  - Idempotente: cada casa recebe no máximo 1 linha de aluguel por mês
 *    (source=MANUAL, sourceRefId="contract-rent:<YYYY-MM>"). Rodar de novo não duplica.
 *  - Aditivo: nunca apaga nem altera lançamentos existentes.
 *  - Pula statements já FECHADOS (closedAt != null).
 *  - Para --apply é OBRIGATÓRIO informar o clientId (evita gravar em outras empresas).
 *
 * Uso:
 *   node scripts/post-contract-rent-credits.mjs <csvPath> <YYYY-MM> [clientId] [--apply]
 * Ex (dry-run):  node scripts/post-contract-rent-credits.mjs ~/Downloads/delinquency-20260715.csv 2026-06
 * Ex (aplicar):  node scripts/post-contract-rent-credits.mjs ~/Downloads/delinquency-20260715.csv 2026-06 <clientId> --apply
 */
import { PrismaClient, Prisma } from '@prisma/client';
import fs from 'fs';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const pos = args.filter((a) => !a.startsWith('--'));
const csvPath = pos[0];
const yearMonth = pos[1];
const clientId = pos[2] || null;

if (!csvPath || !/^\d{4}-(0[1-9]|1[0-2])$/.test(yearMonth || '')) {
  console.error('Uso: node scripts/post-contract-rent-credits.mjs <csvPath> <YYYY-MM> [clientId] [--apply]');
  process.exit(1);
}
if (apply && !clientId) {
  console.error('ERRO: para --apply é obrigatório informar o clientId (3º argumento).');
  process.exit(1);
}

const prisma = new PrismaClient();

function normAddr(s) {
  return String(s || '').toLowerCase().replace(/#/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
}

// Parser de uma linha CSV respeitando aspas.
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

// Extrai endereços das casas inadimplentes (coluna Unit das linhas de dados; ignora cabeçalhos "-> " e Total).
function readDelinquentAddresses(path) {
  const raw = fs.readFileSync(path, 'utf8');
  const set = new Set();
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const fields = parseCsvLine(line);
    const unit = (fields[0] || '').trim();
    if (!unit || unit === 'Unit' || unit === 'Total' || unit.startsWith('->')) continue;
    set.add(normAddr(unit));
  }
  return set;
}

function isDelinquent(propAddrNorm, delinquentSet) {
  if (delinquentSet.has(propAddrNorm)) return true;
  // match tolerante: o "Unit" do CSV costuma ser um prefixo do endereço completo da casa.
  for (const d of delinquentSet) {
    if (!d) continue;
    if (propAddrNorm.startsWith(d) || d.startsWith(propAddrNorm) || propAddrNorm.includes(d)) return true;
  }
  return false;
}

async function recomputeTotals(payoutId) {
  const rows = await prisma.statementLineItem.findMany({
    where: { ownerMonthPayoutId: payoutId },
    select: { lineType: true, amount: true },
  });
  let inc = new Prisma.Decimal(0), exp = new Prisma.Decimal(0);
  for (const r of rows) {
    if (r.lineType === 'income') inc = inc.add(r.amount);
    else if (r.lineType === 'expense') exp = exp.add(r.amount);
  }
  await prisma.ownerMonthPayout.update({
    where: { id: payoutId },
    data: { totalIncome: inc, totalExpenses: exp, netPayout: inc.sub(exp) },
  });
}

const delinquent = readDelinquentAddresses(csvPath);
console.log(`Inadimplentes no CSV: ${delinquent.size} casa(s).`);

const props = await prisma.property.findMany({
  where: { ...(clientId ? { clientId } : {}) },
  select: { id: true, code: true, address: true, rent: true, clientId: true },
  orderBy: { code: 'asc' },
});

const txnDate = new Date(`${yearMonth}-01T12:00:00.000Z`);
const sourceRefId = `contract-rent:${yearMonth}`;

let toPost = [], skippedDelq = 0, skippedNoRent = 0, skippedClosed = 0, already = 0, posted = 0, failed = 0;

for (const p of props) {
  const addrN = normAddr(p.address);
  if (isDelinquent(addrN, delinquent)) { skippedDelq++; continue; }
  const rent = Number(p.rent) || 0;
  if (!(rent > 0)) { skippedNoRent++; continue; }
  toPost.push({ ...p, rent });
}

console.log(`Casas na base${clientId ? ' (clientId=' + clientId + ')' : ' (TODAS as empresas)'}: ${props.length}`);
console.log(`  puladas por inadimplência: ${skippedDelq}`);
console.log(`  puladas sem aluguel de contrato: ${skippedNoRent}`);
console.log(`  candidatas a receber aluguel (${yearMonth}): ${toPost.length}`);
console.log(apply ? '\n== APLICANDO (--apply) ==' : '\n== DRY-RUN (nada gravado). Use --apply para efetivar. ==');

for (const p of toPost) {
  if (!apply) {
    console.log(`  [dry] ${p.code} | ${p.address} | +${p.rent.toFixed(2)} (crédito)`);
    continue;
  }
  try {
    const payout = await prisma.ownerMonthPayout.findUnique({
      where: { propertyId_yearMonth: { propertyId: p.id, yearMonth } },
      select: { id: true, closedAt: true, clientId: true },
    });
    if (payout && payout.closedAt) { skippedClosed++; console.log(`  [skip fechado] ${p.code}`); continue; }
    const cid = (payout && payout.clientId) || p.clientId || clientId;
    const pid = payout ? payout.id : (await prisma.ownerMonthPayout.create({
      data: {
        propertyId: p.id, yearMonth, clientId: cid,
        totalIncome: new Prisma.Decimal(0), totalExpenses: new Prisma.Decimal(0), netPayout: new Prisma.Decimal(0),
      }, select: { id: true },
    })).id;
    try {
      await prisma.statementLineItem.create({
        data: {
          ownerMonthPayoutId: pid, lineType: 'income', description: 'Aluguel (contrato)',
          amount: new Prisma.Decimal(p.rent), sortOrder: 0, clientId: cid,
          source: 'MANUAL', sourceRefId, transactionDate: txnDate,
          approvedAt: new Date(), approvedBy: 'system:contract-rent',
        },
      });
      await recomputeTotals(pid);
      posted++;
      console.log(`  [ok] ${p.code} | +${p.rent.toFixed(2)}`);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        already++; console.log(`  [ja existe] ${p.code}`);
      } else { failed++; console.log(`  [FALHA] ${p.code}: ${e.message}`); }
    }
  } catch (e) {
    failed++; console.log(`  [FALHA] ${p.code}: ${e.message}`);
  }
}

if (apply) {
  console.log(`\nResumo: lançados=${posted}, já existiam=${already}, fechados=${skippedClosed}, falhas=${failed}`);
}
await prisma.$disconnect();
