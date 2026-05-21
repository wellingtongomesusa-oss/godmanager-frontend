/**
 * Valida parsing do Auditoria 2026 contra CSV real AppFolio.
 * Lógica COPIADA de public/gm-audit-2026.js (parseAppfolioGeneralLedger).
 * USO: node scripts/qa-audit-real.mjs [caminho/general_ledger.csv]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const AUD_ACC = {
  3150: 'Owner Contribution',
  3250: 'Owner Distribution',
  4100: 'Rent Income',
};

function accLabel(gl) {
  return AUD_ACC[gl] || 'Conta GL ' + gl;
}

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
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
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (Object.prototype.hasOwnProperty.call(row, k) && row[k] !== undefined && row[k] !== null && row[k] !== '')
      return row[k];
  }
  return '';
}

/** Idêntico a gm-audit-2026.js parseAppfolioGeneralLedger */
export function parseAppfolioGeneralLedger(csvText) {
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
  const payKey = rowVal.bind(null, ['Payee / Payer', 'Payee/Payer', 'Payee']);
  const typeKey = rowVal.bind(null, ['Type', 'type']);
  const refKey = rowVal.bind(null, ['Reference', 'reference']);
  const debitKey = rowVal.bind(null, ['Debit', 'debit']);
  const creditKey = rowVal.bind(null, ['Credit', 'credit']);
  const descKey = rowVal.bind(null, ['Description', 'description']);

  let curGl = '';
  let curName = '';
  const properties = {};
  const propOrder = [];

  function ensureProp(key) {
    if (!properties[key]) {
      properties[key] = {
        txs: [],
        income4: 0,
        expense67: 0,
        net4100c: 0,
        debit3250: 0,
        credit3150: 0,
        debit6111: 0,
        ownerHints: [],
      };
      propOrder.push(key);
    }
    return properties[key];
  }

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    if (!row || typeof row !== 'object') continue;
    const pcol = propKey(row);
    const pstr = String(pcol == null ? '' : pcol);
    const desc = String(descKey(row) || '');
    const typeV = String(typeKey(row) || '');

    const gh = glHeader(pstr);
    if (gh) {
      curGl = gh.gl;
      curName = gh.name || accLabel(curGl);
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
    const tx = {
      gl: curGl,
      glLabel: curName || accLabel(curGl),
      date: String(dateKey(row) || '').trim(),
      payee: String(payKey(row) || '').trim(),
      type: typeV,
      ref: String(refKey(row) || '').trim(),
      debit,
      credit,
      description: desc,
    };
    blob.txs.push(tx);

    const g = curGl;
    if (/^4/.test(g)) blob.income4 = round2(blob.income4 + credit);
    if (/^6|^7/.test(g)) blob.expense67 = round2(blob.expense67 + debit);
    if (g === '4100') blob.net4100c = round2(blob.net4100c + credit);
    if (g === '3250') {
      blob.debit3250 = round2(blob.debit3250 + debit);
      if (tx.payee && blob.ownerHints.indexOf(tx.payee) < 0) blob.ownerHints.push(tx.payee);
    }
    if (g === '3150') blob.credit3150 = round2(blob.credit3150 + credit);
    if (g === '6111') blob.debit6111 = round2(blob.debit6111 + debit);
  }

  const keysSorted = propOrder.slice().sort((a, b) => a.localeCompare(b));

  let gRent = 0,
    g3250 = 0,
    g6111 = 0,
    gInc4 = 0,
    gExp67 = 0;
  for (let qi = 0; qi < keysSorted.length; qi++) {
    const pb = properties[keysSorted[qi]];
    gRent += pb.net4100c;
    g3250 += pb.debit3250;
    g6111 += pb.debit6111;
    gInc4 += pb.income4;
    gExp67 += pb.expense67;
  }
  const globalFeePct = gRent > 0 ? round2((g6111 / gRent) * 100) : null;

  return {
    properties,
    keysSorted,
    totals: {
      rent4100: round2(gRent),
      dist3250: round2(g3250),
      fee6111: round2(g6111),
      income4: round2(gInc4),
      expense67: round2(gExp67),
      globalFeePct,
      props: keysSorted.length,
    },
  };
}

function findLasso(properties) {
  for (const k of Object.keys(properties)) {
    if (/241\s+Lasso/i.test(k)) return [k, properties[k]];
  }
  return [null, null];
}

function near(a, b, eps = 0.02) {
  return Math.abs(Number(a) - Number(b)) <= eps;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
const defaultCsv = path.join(
  process.env.HOME || '',
  'Downloads/general_ledger-20260516.csv',
);
let csvArg = process.argv[2];
if (!csvArg) {
  csvArg = fs.existsSync(defaultCsv)
    ? defaultCsv
    : path.join(path.dirname(__dirname), 'general_ledger.csv');
}

if (!fs.existsSync(csvArg)) {
  console.error('CSV não encontrado:', csvArg);
  process.exit(2);
}

const csvText = fs.readFileSync(csvArg, 'utf8');
const { properties, totals, keysSorted } = parseAppfolioGeneralLedger(csvText);
const [lassoKey, lassoPb] = findLasso(properties);
const pctLasso =
  lassoPb && lassoPb.net4100c > 0 ? round2((lassoPb.debit6111 / lassoPb.net4100c) * 100) : null;

const EXP = {
  props: 86,
  rent4100: 781059.47,
  dist3250: 570912.08,
  fee6111: 44010.15,
  lasso4100: 17500.0,
  lasso3250: 6580.01,
  lasso6111: 1400.0,
  lassoPct: 8.0,
  lassoInc4: 17500.6,
  lassoExp67: 10001.69,
};

const checks = [
  ['Propriedades (count)', EXP.props, totals.props, totals.props === EXP.props],
  ['Total global 4100 (credit)', EXP.rent4100, totals.rent4100, near(totals.rent4100, EXP.rent4100)],
  ['Total global 3250 (debit)', EXP.dist3250, totals.dist3250, near(totals.dist3250, EXP.dist3250)],
  ['Total global 6111 (debit)', EXP.fee6111, totals.fee6111, near(totals.fee6111, EXP.fee6111)],
  [
    '241 Lasso existe',
    '(chave esperada substring 241 Lasso)',
    lassoKey || '(nenhuma)',
    Boolean(lassoKey),
  ],
];

if (lassoPb) {
  checks.push(
    ['241 Lasso 4100', EXP.lasso4100, round2(lassoPb.net4100c), near(lassoPb.net4100c, EXP.lasso4100)],
    ['241 Lasso 3250', EXP.lasso3250, round2(lassoPb.debit3250), near(lassoPb.debit3250, EXP.lasso3250)],
    ['241 Lasso 6111', EXP.lasso6111, round2(lassoPb.debit6111), near(lassoPb.debit6111, EXP.lasso6111)],
    [
      '241 Lasso % fee/rent',
      EXP.lassoPct + '%',
      pctLasso == null ? '—' : pctLasso + '%',
      pctLasso != null && near(pctLasso, EXP.lassoPct, 0.05),
    ],
    ['241 Lasso Income 4xxx (credit)', EXP.lassoInc4, round2(lassoPb.income4), near(lassoPb.income4, EXP.lassoInc4)],
    ['241 Lasso Expense 6/7xxx (debit)', EXP.lassoExp67, round2(lassoPb.expense67), near(lassoPb.expense67, EXP.lassoExp67)],
  );
}

console.log('CSV utilizado:', path.resolve(csvArg));
console.log('Bytes:', Buffer.byteLength(csvText, 'utf8'));
console.log('');

console.log('| Métrica | Esperado | Obtido | Status |');
console.log('|---------|----------|--------|--------|');

for (const [label, exp, got, ok] of checks) {
  const st = ok ? 'OK' : 'FAIL';
  console.log('| ' + label + ' | ' + exp + ' | ' + got + ' | ' + st + ' |');
}

console.log('');
console.log(
  'Tot parser (extras): Income 4xxx agregado (todos)',
  totals.income4,
  '| Expense 6/7 agregado',
  totals.expense67,
);

if (!lassoPb) console.log('\n(AVISO: nenhuma linha Property combinou /241 Lasso/i)');
}
