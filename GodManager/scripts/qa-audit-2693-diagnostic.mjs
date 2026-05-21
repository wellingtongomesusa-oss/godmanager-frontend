/**
 * Diagnóstico pontual 2693 Armstrong (A+B) — só impressão, sem alterar app.
 * USO: node scripts/qa-audit-2693-diagnostic.mjs [general_ledger.csv]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function fmtUsd(n) {
  return Number(n || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function money(cell) {
  const s = String(cell == null ? '' : cell).trim();
  if (!s) return 0;
  let t = s.replace(/^["']+|["']+$/g, '');
  t = t.replace(/[$\u00a0\s]/g, '');
  const par = /^\(.*\)$/.test(t);
  if (par) t = t.slice(1, -1);
  let x = parseFloat(t.replace(/,/g, ''));
  if (!isFinite(x)) return 0;
  if (par) x = -x;
  return round2(x);
}

function glHeader(txt) {
  const m = String(txt || '').match(/^\s*->\s*(\d{4})\s*-\s*(.+?)\s*$/);
  if (!m) return null;
  return { gl: m[1], name: String(m[2]).trim() };
}

function rowVal(keys, row) {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(row, k) && row[k] !== undefined && row[k] !== null && row[k] !== '')
      return row[k];
  }
  return '';
}

function parseYmFromAppfolioDate(ds) {
  const s = String(ds == null ? '' : ds).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-/);
  if (iso) return iso[1] + '-' + iso[2];
  const md = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!md) return null;
  const M = parseInt(md[1], 10);
  const Y = parseInt(md[3], 10);
  if (!isFinite(M) || !isFinite(Y) || M < 1 || M > 12) return null;
  return Y + '-' + String(M).padStart(2, '0');
}

function ownerGlHeadSegment(propertyKey) {
  const k = String(propertyKey || '').trim();
  const di = k.indexOf(' - ');
  return di >= 0 ? k.slice(0, di).trim() : k;
}

function extractUnitSuffix(propertyKey) {
  const seg = ownerGlHeadSegment(propertyKey);
  const patterns = [
    /\s+#\s*([AB])\s*$/i,
    /\s*#\s*([AB])\s*$/i,
    /\s+unit\s*([AB])\s*$/i,
    /\s*\(unit\s*([AB])\)\s*$/i,
    /\s*\(([AB])\)\s*$/i,
  ];
  for (const re of patterns) {
    const m = seg.match(re);
    if (m && m[1]) return String(m[1]).toUpperCase();
  }
  return '';
}

function baseGroupKey(propertyKey) {
  const seg = ownerGlHeadSegment(propertyKey);
  const base = seg
    .replace(/\s+#\s*[AB]\s*$/i, '')
    .replace(/\s*#\s*[AB]\s*$/i, '')
    .replace(/\s+unit\s*[AB]\s*$/i, '')
    .replace(/\s*\(unit\s*[AB]\)\s*$/i, '')
    .replace(/\s*\([AB]\)\s*$/i, '')
    .trim();
  return base.toLowerCase();
}

function groupDisplayLabel(memberKeys) {
  if (memberKeys.length <= 1) return memberKeys[0] || '';
  const suffixes = [];
  const seen = new Set();
  for (const pk of memberKeys) {
    const suf = extractUnitSuffix(pk);
    if (suf && !seen.has(suf)) {
      seen.add(suf);
      suffixes.push(suf);
    }
  }
  suffixes.sort();
  let head = ownerGlHeadSegment(memberKeys[0]);
  head = head
    .replace(/\s+#\s*[AB]\s*$/i, '')
    .replace(/\s*#\s*[AB]\s*$/i, '')
    .replace(/\s+unit\s*[AB]\s*$/i, '')
    .replace(/\s*\(unit\s*[AB]\)\s*$/i, '')
    .replace(/\s*\([AB]\)\s*$/i, '')
    .trim();
  return suffixes.length ? `${head} (${suffixes.join('+')})` : `${head} (${memberKeys.length} un.)`;
}

function parseAppfolioGeneralLedger(csvText) {
  const p = Papa.parse(csvText.trim(), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader(h) {
      return String(h || '').trim();
    },
  });
  const rows = p.data || [];
  const propKey = rowVal.bind(null, ['Property', 'property']);
  const dateKey = rowVal.bind(null, ['Date', 'date']);
  const typeKey = rowVal.bind(null, ['Type', 'type']);
  const descKey = rowVal.bind(null, ['Description', 'description']);
  const debitKey = rowVal.bind(null, ['Debit', 'debit']);
  const creditKey = rowVal.bind(null, ['Credit', 'credit']);

  let curGl = '';
  const properties = {};
  const propOrder = [];

  function ensureProp(key) {
    if (!properties[key]) {
      properties[key] = { txs: [] };
      propOrder.push(key);
    }
    return properties[key];
  }

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const pstr = String(propKey(row) == null ? '' : propKey(row));
    const desc = String(descKey(row) || '');
    const typeV = String(typeKey(row) || '');
    const gh = glHeader(pstr);
    if (gh) {
      curGl = gh.gl;
      continue;
    }
    if (/starting\s+balance/i.test(pstr) || /starting\s+balance/i.test(typeV + ' ' + desc)) continue;
    const propTrim = pstr.trim();
    if (!propTrim || /^->/.test(propTrim)) continue;
    if (!curGl) continue;
    const debit = money(debitKey(row));
    const credit = money(creditKey(row));
    if (!debit && !credit && !desc && !typeV) continue;
    const blob = ensureProp(propTrim);
    blob.txs.push({
      gl: curGl,
      date: String(dateKey(row) || '').trim(),
      debit,
      credit,
      description: desc,
      type: typeV,
      _pk: propTrim,
    });
  }

  return { properties, keysSorted: propOrder.slice().sort((a, b) => a.localeCompare(b)) };
}

function totals4100CreditsDebitsNet(pv) {
  let credits = 0;
  let debits = 0;
  let nCr = 0;
  let nDb = 0;
  for (const tx of pv.txs || []) {
    if (tx.gl !== '4100') continue;
    if (tx.credit > 0.009) {
      credits = round2(credits + tx.credit);
      nCr += 1;
    }
    if (tx.debit > 0.009) {
      debits = round2(debits + tx.debit);
      nDb += 1;
    }
  }
  return { credits, debits, net: round2(credits - debits), nCr, nDb };
}

function totals3250(pv) {
  let dist3250 = 0;
  let count3250 = 0;
  for (const tx of pv.txs || []) {
    if (tx.gl === '3250' && tx.debit > 0) {
      dist3250 = round2(dist3250 + tx.debit);
      count3250 += 1;
    }
  }
  return { dist3250, count3250 };
}

function mergeTxs(memberKeys, properties) {
  const txs = [];
  for (const pk of memberKeys) {
    const pv = properties[pk];
    if (pv && pv.txs) txs.push(...pv.txs);
  }
  return { txs };
}

function list4100ReverseNsfLines(txs) {
  const out = [];
  for (const tx of txs || []) {
    if (tx.gl !== '4100') continue;
    const typ = String(tx.type || '');
    if (!/reverse|reversed|nsf/i.test(typ)) continue;
    const inDebit = tx.debit > 0.009;
    const inCredit = tx.credit > 0.009;
    let col = '(vazio)';
    let raw = 0;
    if (inDebit && !inCredit) {
      col = 'DÉBITO';
      raw = tx.debit;
    } else if (inCredit && !inDebit) {
      col = 'CRÉDITO';
      raw = tx.credit;
    } else if (inDebit && inCredit) {
      col = 'DÉBITO+CRÉDITO';
      raw = tx.debit;
    }
    out.push({
      date: tx.date,
      type: typ,
      col,
      raw,
      debit: tx.debit,
      credit: tx.credit,
      description: tx.description || '',
      propertyKey: tx._pk || '',
    });
  }
  return out;
}

const defaultCsv = path.join(
  process.env.HOME || '',
  'Downloads/general_ledger-20260520 (3).csv',
);
const csvArg =
  process.argv[2] ||
  (fs.existsSync(defaultCsv)
    ? defaultCsv
    : path.join(process.env.HOME || '', 'Downloads/general_ledger-20260516.csv'));

if (!fs.existsSync(csvArg)) {
  console.error('CSV não encontrado:', csvArg);
  process.exit(2);
}

const ctx = parseAppfolioGeneralLedger(fs.readFileSync(csvArg, 'utf8'));
const TARGET_BASE = '2693 armstrong avenue';

const all2693Keys = ctx.keysSorted.filter((k) => /2693/i.test(k));
const groupMembers = ctx.keysSorted.filter((k) => baseGroupKey(k) === TARGET_BASE);
const displayLabel = groupDisplayLabel(groupMembers);

console.log('=== DIAGNÓSTICO 2693 Armstrong (A+B) ===');
console.log('CSV:', path.resolve(csvArg));
console.log('baseGroupKey:', TARGET_BASE);
console.log('displayLabel UI:', displayLabel);
console.log('');

console.log('--- 1) TODAS as propertyKeys do GL no grupo (baseGroupKey match) ---');
console.log('count:', groupMembers.length);
for (let i = 0; i < groupMembers.length; i++) {
  console.log(`[${i + 1}] ${groupMembers[i]}`);
  console.log(`    unitSuffix: ${extractUnitSuffix(groupMembers[i]) || '(nenhum)'}`);
}
console.log('');

console.log('--- (extra) TODAS as keys GL que contêm "2693" (qualquer agrupamento) ---');
for (const k of all2693Keys) {
  const inGroup = groupMembers.includes(k) ? 'SIM grupo' : 'FORA do grupo';
  console.log(`  [${inGroup}] baseKey=${baseGroupKey(k)} | ${k}`);
}
console.log('');

const merged = mergeTxs(groupMembers, ctx.properties);
const g4100 = totals4100CreditsDebitsNet(merged);
const g3250 = totals3250(merged);

console.log('--- 2) Conta 4100 — grupo A+B (correção líquida: créditos − débitos) ---');
console.log('  TOTAL CRÉDITOS 4100:', fmtUsd(g4100.credits), `| lançamentos: ${g4100.nCr}`);
console.log('  TOTAL DÉBITOS 4100: ', fmtUsd(g4100.debits), `| lançamentos: ${g4100.nDb}`);
console.log('  LÍQUIDO 4100 (rent4100):', fmtUsd(g4100.net));
console.log('  (referência) 3250 dist:', fmtUsd(g3250.dist3250), `| lanç: ${g3250.count3250}`);
console.log('  delta vs esperado rent líquido ~14451:', fmtUsd(round2(g4100.net - 14451)));
console.log('');

console.log('--- Por key: 4100 créditos / débitos / líquido ---');
for (const pk of groupMembers) {
  const pv = ctx.properties[pk];
  const t = totals4100CreditsDebitsNet(pv);
  const d = totals3250(pv);
  console.log('');
  console.log('KEY:', pk);
  console.log('  4100 CRÉDITOS:', fmtUsd(t.credits), `(${t.nCr} lanç.)`);
  console.log('  4100 DÉBITOS: ', fmtUsd(t.debits), `(${t.nDb} lanç.)`);
  console.log('  4100 LÍQUIDO: ', fmtUsd(t.net));
  console.log('  3250 dist:    ', fmtUsd(d.dist3250), `(${d.count3250} lanç.)`);
}
console.log('');

console.log('--- 3) Linhas 4100 Reverse / Reversed / NSF (sinal CRU do CSV) ---');
const revLines = list4100ReverseNsfLines(merged.txs);
console.log('count:', revLines.length);
for (const ln of revLines) {
  console.log(
    `  ${ln.date} | coluna=${ln.col} | valor=${fmtUsd(ln.raw)} | débito CSV=${fmtUsd(ln.debit)} | crédito CSV=${fmtUsd(ln.credit)} | ${ln.type} | ${String(ln.propertyKey).slice(0, 70)}`,
  );
  if (ln.description) console.log(`    desc: ${String(ln.description).slice(0, 100)}`);
}
