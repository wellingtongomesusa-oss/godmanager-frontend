#!/usr/bin/env node
/**
 * Importa os pagamentos de aluguel do general ledger (AppFolio) para
 * PropertyRentReceipt — agregado por propriedade/mês, com mgmt fee calculado
 * pela regra da propriedade (mgmtFeePct; default 8% se fora de 0–30).
 *
 * Idempotente (upsert por clientId+propertyKey+periodMonth).
 *
 * Uso:
 *   node scripts/import-rent-receipts.mjs --prod [--file=~/Downloads/general_ledger-20260709.csv]        (DRY-RUN)
 *   node scripts/import-rent-receipts.mjs --prod --apply
 *   node scripts/import-rent-receipts.mjs --prod --client=<id>
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { PrismaClient } from '@prisma/client';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--apply');
const USE_PROD = process.argv.includes('--prod');
const clientArg = (process.argv.find((a) => a.startsWith('--client=')) || '').split('=')[1] || '';
const fileArg = (process.argv.find((a) => a.startsWith('--file=')) || '').split('=')[1] || '';
const CSV_PATH = fileArg
  ? fileArg.replace(/^~/, homedir())
  : join(homedir(), 'Downloads', 'general_ledger-20260709.csv');

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
const amt = (r) => {
  const n = parseFloat(String(r || '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
};
const normKey = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[.,#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const effPct = (raw) => (!Number.isFinite(raw) || raw < 0 || raw > 30 ? 8 : raw);

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
  const cs = await prisma.client.findMany({
    where: { companyName: { contains: 'Manager Prop', mode: 'insensitive' } },
    select: { id: true },
  });
  if (cs.length === 1) return cs[0].id;
  console.error('Não resolveu cliente único "Manager Prop" — use --client=<id>.');
  return null;
}

async function main() {
  console.log(`[import-rent-receipts] modo=${APPLY ? 'APPLY' : 'DRY-RUN'} db=${USE_PROD ? 'PROD' : 'LOCAL'}`);
  console.log(`CSV: ${CSV_PATH}`);
  const clientId = await resolveClientId();
  if (!clientId) {
    await prisma.$disconnect();
    process.exit(1);
  }

  // 1) parse + agrega por (propShort, month)
  const lines = readFileSync(CSV_PATH, 'utf8').split(/\r?\n/);
  const agg = new Map(); // key -> {propShort, propRaw, month, gross, count}
  for (const line of lines) {
    if (!line.trim()) continue;
    const f = parseCsvLine(line);
    const prop = (f[0] || '').trim();
    if (!prop || prop === 'Property' || prop === 'Starting Balance' || prop.startsWith('->')) continue;
    const m = (f[1] || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) continue;
    const month = `${m[3]}-${m[1]}`;
    const credit = amt(f[6]);
    if (credit <= 0) continue;
    const propShort = prop.split(' - ')[0].trim();
    const key = normKey(propShort) + '|' + month;
    const cur = agg.get(key) || { propShort, propRaw: prop, month, gross: 0, count: 0 };
    cur.gross += credit;
    cur.count += 1;
    agg.set(key, cur);
  }
  console.log(`Agregados: ${agg.size} (propriedade x mês)`);

  // 2) properties do cliente p/ casar
  const props = await prisma.property.findMany({
    where: { clientId },
    select: { id: true, address: true, code: true, mgmtFeePct: true },
  });
  const matchProp = (propShort, propRaw) => {
    const keys = [normKey(propShort), normKey(propRaw)].filter(Boolean);
    for (const p of props) {
      const cands = [normKey(p.address), normKey(p.code)].filter(Boolean);
      for (const k of keys) for (const c of cands) if (c === k || c.startsWith(k) || k.startsWith(c)) return p;
    }
    return null;
  };

  // 3) upsert
  let planned = 0;
  let unmatched = 0;
  const monthTotals = {};
  for (const a of agg.values()) {
    const p = matchProp(a.propShort, a.propRaw);
    const pct = effPct(p ? Number(p.mgmtFeePct) : NaN);
    const fee = Math.round(a.gross * pct) / 100;
    const net = Math.round((a.gross - fee) * 100) / 100;
    if (!p) unmatched++;
    monthTotals[a.month] = monthTotals[a.month] || { gross: 0, net: 0 };
    monthTotals[a.month].gross += a.gross;
    monthTotals[a.month].net += net;
    planned++;
    if (APPLY) {
      await prisma.propertyRentReceipt.upsert({
        where: {
          clientId_propertyKey_periodMonth: {
            clientId,
            propertyKey: normKey(a.propShort),
            periodMonth: a.month,
          },
        },
        create: {
          clientId,
          propertyId: p ? p.id : null,
          propertyKey: normKey(a.propShort),
          propertyLabel: a.propShort,
          periodMonth: a.month,
          grossReceived: a.gross.toFixed(2),
          mgmtFeePct: pct.toFixed(2),
          mgmtFeeAmount: fee.toFixed(2),
          netOwner: net.toFixed(2),
          paymentCount: a.count,
        },
        update: {
          propertyId: p ? p.id : null,
          propertyLabel: a.propShort,
          grossReceived: a.gross.toFixed(2),
          mgmtFeePct: pct.toFixed(2),
          mgmtFeeAmount: fee.toFixed(2),
          netOwner: net.toFixed(2),
          paymentCount: a.count,
        },
      });
    }
  }

  console.log('\nTotais por mês (bruto -> líquido):');
  Object.keys(monthTotals)
    .sort()
    .forEach((k) =>
      console.log(`  ${k}: $${monthTotals[k].gross.toFixed(2)} -> $${monthTotals[k].net.toFixed(2)}`),
    );
  console.log(`\n[resultado] ${APPLY ? 'gravados (upsert)' : 'seriam gravados'}: ${planned} | sem casar propriedade: ${unmatched}`);
  if (!APPLY) console.log('DRY-RUN — nada gravado. Rode com --apply.');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
