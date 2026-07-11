#!/usr/bin/env node
/**
 * Importa os pagamentos INDIVIDUAIS do general ledger (AppFolio) para TenantPayment,
 * que é a fonte do botão "Pagamentos" de cada casa. Assim os recebimentos aparecem
 * lá, por casa, com data/pagador/valor/ref.
 *
 * Idempotente: CsvBatch por contentHash + dedupe por pagamento
 * (propertyAddress+paymentDate+receiptAmount+payerName+reference).
 *
 * Uso:
 *   node scripts/import-gl-payments.mjs --prod [--file=~/Downloads/general_ledger-20260710.csv]   (DRY-RUN)
 *   node scripts/import-gl-payments.mjs --prod --apply
 */
import { readFileSync } from 'fs';
import { dirname, join, basename } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--apply');
const USE_PROD = process.argv.includes('--prod');
const clientArg = (process.argv.find((a) => a.startsWith('--client=')) || '').split('=')[1] || '';
const fileArg = (process.argv.find((a) => a.startsWith('--file=')) || '').split('=')[1] || '';
const CSV_PATH = (fileArg || join(homedir(), 'Downloads', 'general_ledger-20260710.csv')).replace(/^~/, homedir());

function parseCsvLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur); return out;
}
const amt = (r) => { const n = parseFloat(String(r || '').replace(/,/g, '').trim()); return Number.isFinite(n) ? n : 0; };
const normKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

function envVar(name) {
  try { for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) { const m = line.match(new RegExp('^' + name + '=("?)(.+?)\\1\\s*$')); if (m) return m[2]; } } catch {}
  return null;
}
const dbUrl = USE_PROD ? envVar('DATABASE_URL_PRODUCTION') : envVar('DATABASE_URL_LOCAL');
if (!dbUrl) { console.error('DATABASE_URL não encontrada.'); process.exit(1); }
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

async function resolveClientId() {
  if (clientArg) return clientArg;
  const cs = await prisma.client.findMany({ where: { companyName: { contains: 'Manager Prop', mode: 'insensitive' } }, select: { id: true } });
  if (cs.length === 1) return cs[0].id;
  console.error('Não resolveu cliente único "Manager Prop" — use --client=<id>.');
  return null;
}

async function main() {
  console.log(`[import-gl-payments] modo=${APPLY ? 'APPLY' : 'DRY-RUN'} db=${USE_PROD ? 'PROD' : 'LOCAL'}`);
  console.log(`CSV: ${CSV_PATH}`);
  const clientId = await resolveClientId();
  if (!clientId) { await prisma.$disconnect(); process.exit(1); }

  const raw = readFileSync(CSV_PATH, 'utf8');
  const contentHash = createHash('sha256').update(raw).digest('hex');
  const lines = raw.split(/\r?\n/);

  // parse pagamentos (Credit > 0)
  const pays = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const f = parseCsvLine(line);
    const prop = (f[0] || '').trim();
    if (!prop || prop === 'Property' || prop === 'Starting Balance' || prop.startsWith('->')) continue;
    const m = (f[1] || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) continue;
    const credit = amt(f[6]); if (credit <= 0) continue;
    pays.push({
      propertyAddress: prop,
      propShort: prop.split(' - ')[0].trim(),
      paymentDate: new Date(`${m[3]}-${m[1]}-${m[2]}T00:00:00.000Z`),
      payerName: (f[2] || '').trim() || '—',
      type: (f[3] || '').trim() || null,
      reference: (f[4] || '').trim() || null,
      receiptAmount: credit,
      description: (f[8] || '').trim() || null,
    });
  }
  console.log(`Pagamentos no GL: ${pays.length} | contentHash=${contentHash.slice(0, 12)}…`);

  // properties p/ casar
  const props = await prisma.property.findMany({ where: { clientId }, select: { id: true, address: true, code: true } });
  const matchProp = (short, full) => {
    const keys = [normKey(short), normKey(full)].filter(Boolean);
    for (const p of props) { const cands = [normKey(p.address), normKey(p.code)].filter(Boolean); for (const k of keys) for (const c of cands) if (c === k || c.startsWith(k) || k.startsWith(c)) return p; }
    return null;
  };

  // batch idempotente por hash
  let batch = await prisma.csvBatch.findUnique({ where: { contentHash } }).catch(() => null);
  let created = 0, skipped = 0, unmatched = 0;

  if (APPLY && !batch) {
    batch = await prisma.csvBatch.create({
      data: {
        clientId, type: 'general_ledger_payments', filename: basename(CSV_PATH),
        contentHash, rowCount: pays.length, totalAmount: pays.reduce((s, p) => s + p.receiptAmount, 0).toFixed(2),
      },
    });
  }

  for (const p of pays) {
    const prop = matchProp(p.propShort, p.propertyAddress);
    if (!prop) unmatched++;
    const exists = await prisma.tenantPayment.findFirst({
      where: {
        clientId, propertyAddress: p.propertyAddress, paymentDate: p.paymentDate,
        receiptAmount: p.receiptAmount.toFixed(2), payerName: p.payerName,
        ...(p.reference ? { reference: p.reference } : {}),
      },
      select: { id: true },
    });
    if (exists) { skipped++; continue; }
    created++;
    if (APPLY) {
      await prisma.tenantPayment.create({
        data: {
          clientId, propertyId: prop ? prop.id : null, propertyAddress: p.propertyAddress,
          payerName: p.payerName, paymentDate: p.paymentDate, type: p.type, reference: p.reference,
          receiptAmount: p.receiptAmount.toFixed(2), cashAccount: '4100 - Rent Income',
          description: p.description, csvBatchId: batch.id,
        },
      });
    }
  }

  console.log(`\n[resultado] ${APPLY ? 'criados' : 'seriam criados'}: ${created} | já existiam: ${skipped} | sem casar casa: ${unmatched}`);
  if (!APPLY) console.log('DRY-RUN — nada gravado. Rode com --apply.');
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
