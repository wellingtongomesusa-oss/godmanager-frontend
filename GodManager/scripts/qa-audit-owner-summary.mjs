/**
 * Resumo consolidado Auditoria do Owner — espelha gm-audit-2026.js (parse + ComputeOwnerAuditDistRow).
 * USO: node scripts/qa-audit-owner-summary.mjs [general_ledger.csv]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import Papa from 'papaparse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CLIENT_ID = 'cmoqec9bw0000057uu4p5h15a';

/** Consolidado bugado (script QA antes do fix dist3250) — referência Fase 2. */
const BUGGY_REF = {
  totDevolver: 123247.72,
  nDevolver: 66,
  totReceber: 30113.09,
  nReceber: 21,
  saldoLiquido: 93134.63,
  nCorr: 3,
  nRevisar: 3,
};

function loadEnvLocal() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    out[t.slice(0, eq).trim()] = val;
  }
  return out;
}

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
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (
      Object.prototype.hasOwnProperty.call(row, k) &&
      row[k] !== undefined &&
      row[k] !== null &&
      row[k] !== ''
    )
      return row[k];
  }
  return '';
}

/** Idêntico a public/gm-audit-2026.js parseAppfolioGeneralLedger + enriched */
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
        exp67Ex611: 0,
        net4100c: 0,
        debit3250: 0,
        credit3150: 0,
        debit6111: 0,
        ownerHints: [],
        fee6111Txns: [],
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
      curName = gh.name || ('Conta GL ' + curGl);
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
      glLabel: curName,
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
    if (/^6|^7/.test(g)) {
      blob.expense67 = round2(blob.expense67 + debit);
      if (g !== '6111') blob.exp67Ex611 = round2(blob.exp67Ex611 + debit);
    }
    if (g === '4100') blob.net4100c = round2(blob.net4100c + credit);
    if (g === '3250') {
      blob.debit3250 = round2(blob.debit3250 + debit);
      if (tx.payee && blob.ownerHints.indexOf(tx.payee) < 0) blob.ownerHints.push(tx.payee);
    }
    if (g === '3150') blob.credit3150 = round2(blob.credit3150 + credit);
    if (g === '6111') blob.debit6111 = round2(blob.debit6111 + debit);
  }

  const keysSorted = propOrder.slice().sort((a, b) => a.localeCompare(b));
  const enriched = {};
  for (const key of keysSorted) {
    const pb = properties[key];
    enriched[key] = {
      key,
      txs: pb.txs,
      income4: pb.income4,
      expense67: pb.expense67,
      rent4100: pb.net4100c,
      dist3250: pb.debit3250,
      fee6111: pb.debit6111,
      ownerAuditExpenseEx611: round2(pb.exp67Ex611),
    };
  }

  return { properties: enriched, keysSorted };
}

function normalizeAddress(addr) {
  return String(addr || '')
    .toLowerCase()
    .replace(/[#,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSimilarity(a, b) {
  const split = (s) =>
    new Set(
      String(s || '')
        .toLowerCase()
        .split(/[\s,.\-#]+/)
        .filter((t) => t.length > 0),
    );
  const tokensA = split(a);
  const tokensB = split(b);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const t of tokensA) if (tokensB.has(t)) intersection++;
  return intersection / (tokensA.size + tokensB.size - intersection);
}

function matchPropertyWithMeta(paymentAddress, properties) {
  const parts = String(paymentAddress || '')
    .split(' - ')
    .map((x) => x.trim())
    .filter(Boolean);
  for (const part of parts) {
    const normalizedPart = normalizeAddress(part);
    const matches = properties.filter((pr) => normalizeAddress(pr.address) === normalizedPart);
    if (matches.length === 1) {
      return { propertyId: matches[0].id, score: 1, method: 'exact_part', prop: matches[0] };
    }
  }
  let best = null;
  for (const prop of properties) {
    const score = tokenSimilarity(paymentAddress, prop.address);
    if (score >= 0.6 && (!best || score > best.score)) {
      best = { propertyId: prop.id, score, method: 'token', prop };
    }
  }
  return best;
}

function isAggregateKey(key) {
  const k = String(key || '').trim();
  if (!k) return true;
  if (/^->\s*\d{4}/i.test(k)) return true;
  if (/^starting\s+balance/i.test(k)) return true;
  if (/^net\s+change$/i.test(k)) return true;
  if (/^total$/i.test(k)) return true;
  return false;
}

function pctStatus(mgmtFeePct, matched) {
  if (!matched) return { kind: 'unmatched', pct: null };
  const p = Number(mgmtFeePct);
  if (!isFinite(p) || p === 0) return { kind: 'missing', pct: null };
  if (p >= 1 && p <= 20) return { kind: 'valid', pct: round2(p) };
  return { kind: 'suspicious', pct: round2(p) };
}

/**
 * Espelho exato gmAudit2026ComputeOwnerAuditDistRow (public/gm-audit-2026.js).
 */
function gmAudit2026ComputeOwnerAuditDistRow(pv, savedPctFromDbOrNull) {
  const income = Number(pv.income4 || 0);
  const rent = Number(pv.rent4100 || 0);
  const distribuido = Number(pv.dist3250 || 0);
  const despEx =
    pv.ownerAuditExpenseEx611 != null
      ? Number(pv.ownerAuditExpenseEx611)
      : round2(Number(pv.expense67 || 0) - Number(pv.fee6111 || 0));

  const hasPct =
    savedPctFromDbOrNull != null &&
    savedPctFromDbOrNull !== undefined &&
    isFinite(Number(savedPctFromDbOrNull)) &&
    Number(savedPctFromDbOrNull) >= 0 &&
    Number(savedPctFromDbOrNull) <= 100;

  const pctNum = hasPct ? Number(savedPctFromDbOrNull) : null;
  const feeDevido =
    hasPct && rent >= 0 ? round2((pctNum / 100) * rent) : null;
  const netDevido =
    hasPct && feeDevido != null ? round2(income - feeDevido - despEx) : null;
  const overPayment =
    hasPct && netDevido != null ? round2(distribuido - netDevido) : null;

  return {
    hasPct,
    pctContratada: pctNum,
    income4: income,
    rent4100: rent,
    feeDevido,
    despesas: despEx,
    netDevido,
    distribuido,
    overPayment,
  };
}

function parseYmFromAppfolioDate(ds) {
  const s = String(ds == null ? '' : ds).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-/);
  if (iso) return iso[1] + '-' + iso[2];
  const md = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!md) return null;
  const M = parseInt(md[1], 10);
  const Y = parseInt(md[3], 10);
  if (!Number.isFinite(M) || !Number.isFinite(Y) || M < 1 || M > 12) return null;
  return Y + '-' + String(M).padStart(2, '0');
}

/** Saldo mensal com a mesma fórmula (acumulado por mês, não YTD). */
function monthlyBreakdown(pv, pct) {
  const months = {};
  for (const tx of pv.txs || []) {
    const ym = parseYmFromAppfolioDate(tx.date);
    if (!ym) continue;
    if (!months[ym]) {
      months[ym] = { income4: 0, rent4100: 0, expEx611: 0, dist3250: 0 };
    }
    const m = months[ym];
    const g = tx.gl;
    if (/^4/.test(g)) m.income4 = round2(m.income4 + tx.credit);
    if (g === '4100') m.rent4100 = round2(m.rent4100 + tx.credit);
    if (/^6|^7/.test(g) && g !== '6111') m.expEx611 = round2(m.expEx611 + tx.debit);
    if (g === '3250') m.dist3250 = round2(m.dist3250 + tx.debit);
  }

  const out = [];
  for (const ym of Object.keys(months).sort()) {
    const m = months[ym];
    const row = gmAudit2026ComputeOwnerAuditDistRow(
      {
        income4: m.income4,
        rent4100: m.rent4100,
        dist3250: m.dist3250,
        ownerAuditExpenseEx611: m.expEx611,
      },
      pct,
    );
    out.push({
      ym,
      income4: m.income4,
      rent4100: m.rent4100,
      expEx611: m.expEx611,
      dist3250: m.dist3250,
      feeDevido: row.feeDevido,
      netDevido: row.netDevido,
      saldo: row.overPayment,
    });
  }
  return out;
}

/** Agrega txs filtradas no mesmo formato que parse enriched (cenários B/C). */
function aggregatePvFromTxs(txs) {
  const agg = {
    txs,
    income4: 0,
    expense67: 0,
    exp67Ex611: 0,
    net4100c: 0,
    debit3250: 0,
    debit6111: 0,
  };
  for (const tx of txs) {
    const g = tx.gl;
    if (/^4/.test(g)) agg.income4 = round2(agg.income4 + tx.credit);
    if (/^6|^7/.test(g)) {
      agg.expense67 = round2(agg.expense67 + tx.debit);
      if (g !== '6111') agg.exp67Ex611 = round2(agg.exp67Ex611 + tx.debit);
    }
    if (g === '4100') agg.net4100c = round2(agg.net4100c + tx.credit);
    if (g === '3250') agg.debit3250 = round2(agg.debit3250 + tx.debit);
    if (g === '6111') agg.debit6111 = round2(agg.debit6111 + tx.debit);
  }
  return {
    txs,
    income4: agg.income4,
    rent4100: agg.net4100c,
    dist3250: agg.debit3250,
    fee6111: agg.debit6111,
    ownerAuditExpenseEx611: agg.exp67Ex611,
  };
}

function consolidateOverRows(computedRows) {
  const out = {
    totDevolver: 0,
    totReceber: 0,
    nDevolver: 0,
    nReceber: 0,
    nCorr: 0,
    saldoLiquido: 0,
  };
  for (const r of computedRows) {
    if (r.overPayment == null) continue;
    const ov = r.overPayment;
    if (ov > 1) {
      out.totDevolver = round2(out.totDevolver + ov);
      out.nDevolver += 1;
    } else if (ov < -1) {
      out.totReceber = round2(out.totReceber + Math.abs(ov));
      out.nReceber += 1;
    } else {
      out.nCorr += 1;
    }
  }
  out.saldoLiquido = round2(out.totDevolver - out.totReceber);
  return out;
}

function detectCsvMonthSpan(ctx) {
  const months = new Set();
  let maxDateStr = '';
  let maxTs = -1;
  for (const pk of ctx.keysSorted) {
    const pv = ctx.properties[pk];
    if (!pv) continue;
    for (const tx of pv.txs || []) {
      const ym = parseYmFromAppfolioDate(tx.date);
      if (ym) months.add(ym);
      const md = String(tx.date || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (md) {
        const ts = Date.UTC(parseInt(md[3], 10), parseInt(md[1], 10) - 1, parseInt(md[2], 10));
        if (ts > maxTs) {
          maxTs = ts;
          maxDateStr = tx.date;
        }
      }
    }
  }
  const sorted = [...months].sort();
  let partialLastYm = null;
  if (maxTs >= 0) {
    const dMax = new Date(maxTs);
    if (dMax.getUTCDate() < 25) {
      partialLastYm = parseYmFromAppfolioDate(maxDateStr);
    }
  }
  return {
    first: sorted[0] || null,
    last: sorted[sorted.length - 1] || null,
    months: sorted,
    maxDateStr,
    partialLastYm,
  };
}

function ownerMonthBuckets(pv) {
  const months = {};
  for (const tx of pv.txs || []) {
    const ym = parseYmFromAppfolioDate(tx.date);
    if (!ym) continue;
    if (!months[ym]) {
      months[ym] = { income4: 0, rent4100: 0, expEx611: 0, dist3250: 0 };
    }
    const m = months[ym];
    const g = tx.gl;
    if (/^4/.test(g)) m.income4 = round2(m.income4 + tx.credit);
    if (g === '4100') m.rent4100 = round2(m.rent4100 + tx.credit);
    if (/^6|^7/.test(g) && g !== '6111') m.expEx611 = round2(m.expEx611 + tx.debit);
    if (g === '3250') m.dist3250 = round2(m.dist3250 + tx.debit);
  }
  return months;
}

function expenseTopGlValidMonths(pv, validYmSet) {
  const by = {};
  for (const tx of pv.txs || []) {
    const ym = parseYmFromAppfolioDate(tx.date);
    if (!ym || !validYmSet[ym]) continue;
    const g = tx.gl;
    if (!/^6|^7/.test(g) || g === '6111') continue;
    const d = Number(tx.debit || 0);
    if (d <= 0) continue;
    by[g] = round2((by[g] || 0) + d);
  }
  let topGl = null;
  let topAmt = 0;
  for (const [gl, amt] of Object.entries(by)) {
    if (amt > topAmt) {
      topAmt = amt;
      topGl = gl;
    }
  }
  return { topGl, exp6112: by['6112'] || 0 };
}

function computeOwnerTrimmedAudit(pv, pct, partialLastYm) {
  const buckets = ownerMonthBuckets(pv);
  const validYmSet = {};
  const sum = {
    income4: 0,
    rent4100: 0,
    dist3250: 0,
    ownerAuditExpenseEx611: 0,
  };
  for (const ym of Object.keys(buckets).sort()) {
    const m = buckets[ym];
    const orphan = m.dist3250 > 0.01 && m.income4 < 0.01;
    const isPartial = partialLastYm && ym === partialLastYm;
    if (orphan || isPartial) continue;
    validYmSet[ym] = true;
    sum.income4 = round2(sum.income4 + m.income4);
    sum.rent4100 = round2(sum.rent4100 + m.rent4100);
    sum.dist3250 = round2(sum.dist3250 + m.dist3250);
    sum.ownerAuditExpenseEx611 = round2(sum.ownerAuditExpenseEx611 + m.expEx611);
  }
  const expMeta = expenseTopGlValidMonths(pv, validYmSet);
  const oa = gmAudit2026ComputeOwnerAuditDistRow(sum, pct);
  let triageBand = 'gray';
  if (oa.hasPct && oa.overPayment != null) {
    const o = oa.overPayment;
    if (Math.abs(o) <= 1) triageBand = 'blue';
    else if (o < -1) triageBand = 'green';
    else if (o > 1) {
      triageBand =
        expMeta.topGl === '6112' && expMeta.exp6112 > 0.01 ? 'orange' : 'red';
    }
  }
  return { oa, triageBand, expMeta };
}

function filterTxsByMonths(txs, excludeSet) {
  return (txs || []).filter((tx) => {
    const ym = parseYmFromAppfolioDate(tx.date);
    if (!ym) return true;
    return !excludeSet.has(ym);
  });
}

function expense6112Total(pv) {
  let t = 0;
  for (const tx of pv.txs || []) {
    if (tx.gl === '6112') t = round2(t + tx.debit);
  }
  return t;
}

/** Débitos 6/7 exc. 6111 agrupados por conta GL */
function expenseByAccount(pv) {
  const map = {};
  for (const tx of pv.txs || []) {
    const g = tx.gl;
    if (!/^6|^7/.test(g) || g === '6111') continue;
    if (!map[g]) map[g] = { gl: g, label: tx.glLabel || g, total: 0 };
    map[g].total = round2(map[g].total + tx.debit);
  }
  return Object.values(map).sort((a, b) => b.total - a.total);
}

function fetchPropertiesProd(databaseUrl) {
  const sql = `SELECT id, address, "mgmtFeePct", "hoaAdmin" FROM properties WHERE "clientId" = '${CLIENT_ID}' ORDER BY address;`;
  const out = execSync(`psql "${databaseUrl}" -v ON_ERROR_STOP=1 -t -A -F '|' -c ${JSON.stringify(sql)}`, {
    encoding: 'utf8',
  });
  return out
    .split('\n')
    .filter((l) => l.trim())
    .map((line) => {
      const [id, address, mgmtFeePct, hoaAdmin] = line.split('|');
      return {
        id,
        address: address || '',
        mgmtFeePct: parseFloat(mgmtFeePct || '0') || 0,
        hoaAdmin: String(hoaAdmin).toLowerCase() === 't',
      };
    });
}

const env = loadEnvLocal();
const databaseUrl = env.DATABASE_URL_PRODUCTION || env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL_PRODUCTION ausente');
  process.exit(2);
}

const defaultCsv = path.join(process.env.HOME || '', 'Downloads/general_ledger-20260516.csv');
const csvArg =
  process.argv[2] ||
  (fs.existsSync(defaultCsv) ? defaultCsv : path.join(ROOT, 'general_ledger.csv'));
if (!fs.existsSync(csvArg)) {
  console.error('CSV não encontrado:', csvArg);
  process.exit(2);
}

const ctx = parseAppfolioGeneralLedger(fs.readFileSync(csvArg, 'utf8'));
const dbProps = fetchPropertiesProd(databaseUrl);

const summary = {
  totDevolver: 0,
  totReceber: 0,
  nDevolver: 0,
  nReceber: 0,
  nCorr: 0,
  nRevisar: 0,
};
const allRows = [];
const revisarList = [];

for (const pk of ctx.keysSorted) {
  if (isAggregateKey(pk)) continue;
  const pv = ctx.properties[pk];
  if (!pv) continue;

  const meta = matchPropertyWithMeta(pk, dbProps);
  const st = pctStatus(meta ? meta.prop.mgmtFeePct : 0, !!meta);
  const pct = st.kind === 'valid' ? st.pct : null;

  if (st.kind !== 'valid') {
    summary.nRevisar += 1;
    revisarList.push({ key: pk, reason: st.kind, address: meta ? meta.prop.address : '—' });
    continue;
  }

  const oa = gmAudit2026ComputeOwnerAuditDistRow(pv, pct);
  if (!oa.hasPct || oa.overPayment == null) {
    summary.nRevisar += 1;
    revisarList.push({ key: pk, reason: 'no_calc', address: meta.prop.address });
    continue;
  }

  const row = {
    key: pk,
    address: meta.prop.address,
    pct,
    pv,
    ...oa,
    expAccounts: expenseByAccount(pv),
    monthly: monthlyBreakdown(pv, pct),
    exp6112: expense6112Total(pv),
  };
  allRows.push(row);

  const ov = oa.overPayment;
  if (ov > 1) {
    summary.totDevolver = round2(summary.totDevolver + ov);
    summary.nDevolver += 1;
  } else if (ov < -1) {
    summary.totReceber = round2(summary.totReceber + Math.abs(ov));
    summary.nReceber += 1;
  } else {
    summary.nCorr += 1;
  }
}

summary.saldoLiquido = round2(summary.totDevolver - summary.totReceber);

// --- PASSO 1: Verificação Grander ---
const granderKey = ctx.keysSorted.find((k) => /11267\s+Grander/i.test(k));
let granderSaldo = null;
if (granderKey) {
  const gMeta = matchPropertyWithMeta(granderKey, dbProps);
  const gPct = pctStatus(gMeta ? gMeta.prop.mgmtFeePct : 0, !!gMeta);
  if (gPct.kind === 'valid') {
    const gOa = gmAudit2026ComputeOwnerAuditDistRow(ctx.properties[granderKey], gPct.pct);
    granderSaldo = gOa.overPayment;
  }
}

console.log('=== Auditoria Owner — QA (fórmula UI) ===');
console.log('CSV:', path.resolve(csvArg));
console.log('');
console.log('--- PASSO 1: Verificação 11267 Grander ---');
if (granderSaldo != null) {
  const ok = Math.abs(granderSaldo - 258) < 0.02;
  console.log(
    'Saldo overPayment:',
    fmtUsd(granderSaldo),
    ok ? '(OK = $258,00)' : '(FAIL — esperado $258,00)',
  );
  if (granderKey) {
    const g = gmAudit2026ComputeOwnerAuditDistRow(
      ctx.properties[granderKey],
      pctStatus(matchPropertyWithMeta(granderKey, dbProps).prop.mgmtFeePct, true).pct,
    );
    console.log(
      '  income4:',
      fmtUsd(g.income4),
      '| rent4100:',
      fmtUsd(g.rent4100),
      '| feeDevido:',
      fmtUsd(g.feeDevido),
      '| despesas:',
      fmtUsd(g.despesas),
      '| netDevido:',
      fmtUsd(g.netDevido),
      '| dist3250:',
      fmtUsd(g.distribuido),
    );
  }
} else {
  console.log('11267 Grander não encontrado ou % inválido.');
}
console.log('');

console.log('--- PASSO 2: Consolidado CORRETO vs BUGADO ---');
console.log('| Métrica | Bugado (ref) | Correto (agora) | Delta |');
console.log(
  '| Owners devem devolver | $',
  fmtUsd(BUGGY_REF.totDevolver),
  ' (',
  BUGGY_REF.nDevolver,
  ') | $',
  fmtUsd(summary.totDevolver),
  ' (',
  summary.nDevolver,
  ') | $',
  fmtUsd(round2(summary.totDevolver - BUGGY_REF.totDevolver)),
  ' |',
);
console.log(
  '| A pagar aos owners | $',
  fmtUsd(BUGGY_REF.totReceber),
  ' (',
  BUGGY_REF.nReceber,
  ') | $',
  fmtUsd(summary.totReceber),
  ' (',
  summary.nReceber,
  ') | $',
  fmtUsd(round2(summary.totReceber - BUGGY_REF.totReceber)),
  ' |',
);
console.log(
  '| Saldo líquido | $',
  fmtUsd(BUGGY_REF.saldoLiquido),
  ' | $',
  fmtUsd(summary.saldoLiquido),
  ' | $',
  fmtUsd(round2(summary.saldoLiquido - BUGGY_REF.saldoLiquido)),
  ' |',
);
console.log(
  '| Corretos | ',
  BUGGY_REF.nCorr,
  ' | ',
  summary.nCorr,
  ' | ',
  summary.nCorr - BUGGY_REF.nCorr,
  ' |',
);
console.log(
  '| A revisar | ',
  BUGGY_REF.nRevisar,
  ' | ',
  summary.nRevisar,
  ' | ',
  summary.nRevisar - BUGGY_REF.nRevisar,
  ' |',
);
console.log('');

// --- Análise recorte de período (borda dez / mai parcial) ---
const span = detectCsvMonthSpan(ctx);
const firstMo = span.first;
const lastMo = span.last;
const excludeFirst = firstMo ? new Set([firstMo]) : new Set();
const excludeFirstLast =
  firstMo && lastMo && firstMo !== lastMo
    ? new Set([firstMo, lastMo])
    : excludeFirst;

function scenarioRows(excludeSet) {
  const out = [];
  for (const base of allRows) {
    const txs =
      excludeSet.size === 0
        ? base.pv.txs
        : filterTxsByMonths(base.pv.txs, excludeSet);
    const pvF = aggregatePvFromTxs(txs);
    const oa = gmAudit2026ComputeOwnerAuditDistRow(pvF, base.pct);
    out.push({ key: base.key, overPayment: oa.overPayment, ...oa, pvF });
  }
  return out;
}

const scenA = consolidateOverRows(
  allRows.map((r) => ({ overPayment: r.overPayment })),
);
const scenB = consolidateOverRows(scenarioRows(excludeFirst));
const scenC = consolidateOverRows(scenarioRows(excludeFirstLast));
/** Hipótese auditoria: borda de abertura = dez/2025 (dist = rent nov). */
const scenBDec = consolidateOverRows(
  scenarioRows(new Set(['2025-12'])),
);
/** Meses “completos” no sentido da hipótese: sem dez/25 (rent nov) nem mai/26 parcial. */
const scenCMid = consolidateOverRows(
  scenarioRows(new Set(['2025-12', '2026-05'])),
);

let edgeDistNoIncome = 0;
let edgeSaldoVermelho = 0;
let edgeMonthCount = 0;
let edgePropertyMonths = 0;
let edgeDecSaldo = 0;
let edgeDecDist = 0;
const edgeExamples = [];

for (const r of allRows) {
  for (const mo of r.monthly) {
    const noInc = (mo.income4 || 0) < 0.01;
    const hasDist = (mo.dist3250 || 0) > 0.01;
    if (!noInc || !hasDist) continue;
    edgeMonthCount += 1;
    edgeDistNoIncome = round2(edgeDistNoIncome + mo.dist3250);
    if (mo.ym === '2025-12') edgeDecDist = round2(edgeDecDist + mo.dist3250);
    if (mo.saldo != null && mo.saldo > 1) {
      edgeSaldoVermelho = round2(edgeSaldoVermelho + mo.saldo);
      edgePropertyMonths += 1;
      if (mo.ym === '2025-12') edgeDecSaldo = round2(edgeDecSaldo + mo.saldo);
      if (edgeExamples.length < 8) {
        edgeExamples.push({
          key: r.key,
          ym: mo.ym,
          dist: mo.dist3250,
          saldo: mo.saldo,
        });
      }
    }
  }
}

let totalDesp = 0;
let total6112 = 0;
let redCount = 0;
let red6112Top = 0;
for (const r of allRows) {
  if (r.overPayment == null || r.overPayment <= 1) continue;
  redCount += 1;
  totalDesp = round2(totalDesp + r.despesas);
  total6112 = round2(total6112 + r.exp6112);
  const top = r.expAccounts[0];
  if (top && top.gl === '6112') red6112Top += 1;
}

console.log('=== TESTE RECORTE DE PERÍODO (borda CSV) ===');
console.log('');
console.log('--- PASSO 1: Intervalo de meses no CSV ---');
console.log('Meses com lançamentos:', span.months.join(', '));
console.log('Primeiro mês (borda abertura):', firstMo || '—');
console.log('Último mês (borda fecho):', lastMo || '—');
console.log(
  'Data máxima no ficheiro:',
  span.maxDateStr || '—',
  lastMo === '2026-05' ? '(mai/2026 parcial — export até ~16/mai)' : '',
);
console.log(
  'Nota: dist de',
  firstMo,
  'pode refletir rent de nov/2025 fora deste CSV → dist sem income4 no mês.',
);
console.log('');

function printScen(label, s, excludeDesc) {
  console.log(label + (excludeDesc ? ' — ' + excludeDesc : ''));
  console.log(
    '  A devolver: $',
    fmtUsd(s.totDevolver),
    '| imóveis:',
    s.nDevolver,
  );
  console.log(
    '  A pagar:    $',
    fmtUsd(s.totReceber),
    '| imóveis:',
    s.nReceber,
  );
  console.log('  Saldo líquido: $', fmtUsd(s.saldoLiquido));
  console.log('  Corretos:', s.nCorr);
  console.log('');
}

console.log('--- PASSO 2: Três cenários (mesma fórmula UI, txs filtradas) ---');
printScen('(A) Acumulado total', scenA, 'todos os meses');
printScen('(B) Sem primeiro mês cronológico', scenB, 'exclui ' + (firstMo || '—'));
printScen(
  '(C) Sem primeiro e último cronológicos',
  scenC,
  'exclui ' + (firstMo || '—') + ' e ' + (lastMo || '—'),
);
printScen(
  "(B') Sem dez/2025 (borda rent nov)",
  scenBDec,
  'exclui 2025-12',
);
printScen(
  "(C') Sem dez/25 e mai/26 (meio “limpo”)",
  scenCMid,
  'exclui 2025-12 e 2026-05',
);
console.log(
  'Delta B vs A — a devolver: $',
  fmtUsd(round2(scenA.totDevolver - scenB.totDevolver)),
  '| imóveis:',
  scenA.nDevolver - scenB.nDevolver,
);
console.log(
  "Delta B' (sem dez) vs A — a devolver: $",
  fmtUsd(round2(scenA.totDevolver - scenBDec.totDevolver)),
  '| imóveis:',
  scenA.nDevolver - scenBDec.nDevolver,
);
console.log(
  'Delta C vs A — a devolver: $',
  fmtUsd(round2(scenA.totDevolver - scenC.totDevolver)),
  '| imóveis:',
  scenA.nDevolver - scenC.nDevolver,
);
console.log('');

console.log('--- PASSO 3: Ruído "dist 3250 no mês SEM crédito 4xxx" ---');
console.log(
  'Meses-propriedade com dist>0 e income4=0:',
  edgeMonthCount,
);
console.log(
  'Soma dist 3250 nesses meses (bruto): $',
  fmtUsd(edgeDistNoIncome),
);
console.log(
  'Soma saldo mensal VERMELHO nesses meses: $',
  fmtUsd(edgeSaldoVermelho),
  '(',
  edgePropertyMonths,
  ' meses-imóvel)',
);
console.log(
  'Parte do vermelho total (A):',
  scenA.totDevolver > 0
    ? ((edgeSaldoVermelho / scenA.totDevolver) * 100).toFixed(1) + '%'
    : '—',
);
console.log(
  'Desses, só dez/2025 — dist bruto: $',
  fmtUsd(edgeDecDist),
  '| saldo vermelho mensal: $',
  fmtUsd(edgeDecSaldo),
);
console.log('Exemplos:');
for (const ex of edgeExamples) {
  console.log(
    '  ',
    ex.ym,
    '| dist',
    fmtUsd(ex.dist),
    '| saldo',
    fmtUsd(ex.saldo),
    '|',
    ex.key.slice(0, 55) + (ex.key.length > 55 ? '…' : ''),
  );
}
console.log('');

console.log('--- PASSO 4: Peso do 6112 (Tenant Placement) ---');
console.log(
  'Despesas totais (imóveis vermelhos, cenário A): $',
  fmtUsd(totalDesp),
);
console.log(
  'Dessas, conta 6112: $',
  fmtUsd(total6112),
  '(',
  totalDesp > 0 ? ((total6112 / totalDesp) * 100).toFixed(1) : '0',
  '%)',
);
console.log(
  'Imóveis vermelhos com 6112 como MAIOR despesa:',
  red6112Top,
  'de',
  redCount,
  '(',
  redCount > 0 ? ((red6112Top / redCount) * 100).toFixed(1) : '0',
  '%)',
);
console.log('');

console.log('--- PASSO 3 (legado): TOP 10 vermelhos (maiores saldos) ---');
const topRed = allRows
  .filter((r) => r.overPayment != null && r.overPayment > 1)
  .sort((a, b) => b.overPayment - a.overPayment)
  .slice(0, 10);

for (let i = 0; i < topRed.length; i++) {
  const r = topRed[i];
  console.log('');
  console.log(`#${i + 1} | saldo $${fmtUsd(r.overPayment)} | ${r.pct}%`);
  console.log('  GL:', r.key.length > 95 ? r.key.slice(0, 92) + '…' : r.key);
  console.log('  DB:', r.address);
  console.log('  income4:', fmtUsd(r.income4), '| feeDevido:', fmtUsd(r.feeDevido), `(${r.pct}% × rent4100 ${fmtUsd(r.rent4100)})`);
  console.log('  despesas (6/7 ex 6111):', fmtUsd(r.despesas));
  for (const ea of r.expAccounts) {
    const tag =
      ea.gl === '6112'
        ? ' [PLACEMENT]'
        : ea.gl === '6147'
          ? ' [REPAIRS]'
          : ea.gl === '6076'
            ? ' [CLEAN/MAINT]'
            : '';
    console.log(`    ${ea.gl} ${ea.label}: $${fmtUsd(ea.total)}${tag}`);
  }
  console.log('  netDevido:', fmtUsd(r.netDevido), '| dist3250:', fmtUsd(r.distribuido), '| saldo:', fmtUsd(r.overPayment));
  console.log('  Mensal (saldo = dist3250 − netDevido no mês):');
  for (const mo of r.monthly) {
    const band =
      mo.saldo == null
        ? '—'
        : mo.saldo > 1
          ? 'VERM'
          : mo.saldo < -1
            ? 'VERD'
            : 'OK';
    console.log(
      `    ${mo.ym} | inc4 ${fmtUsd(mo.income4)} | fee ${fmtUsd(mo.feeDevido)} | exp ${fmtUsd(mo.expEx611)} | net ${fmtUsd(mo.netDevido)} | 3250 ${fmtUsd(mo.dist3250)} | saldo ${mo.saldo == null ? '—' : fmtUsd(mo.saldo)} [${band}]`,
    );
  }
}

console.log('');
console.log('--- A revisar ---');
for (const r of revisarList) {
  console.log(`  [${r.reason}] ${r.key.slice(0, 70)}…`);
}

// --- FASE 3: Triagem com recorte (espelha UI) ---
const csvSpan = detectCsvMonthSpan(ctx);
const triage = {
  saldoLiquido: 0,
  totRedReal: 0,
  nRedReal: 0,
  totOrange: 0,
  nOrange: 0,
  totGreenPay: 0,
  nGreenPay: 0,
  nBlueOk: 0,
  nRevisar: summary.nRevisar,
  brutoLiquido: round2(summary.saldoLiquido),
};
const triageRows = [];

for (const base of allRows) {
  const trim = computeOwnerTrimmedAudit(base.pv, base.pct, csvSpan.partialLastYm);
  const oa = trim.oa;
  const row = {
    key: base.key,
    address: base.address,
    pct: base.pct,
    triageBand: trim.triageBand,
    saldo: oa.overPayment,
    oa,
    bruto: base.overPayment,
  };
  triageRows.push(row);
  if (trim.triageBand === 'red' && oa.overPayment > 1) {
    triage.totRedReal = round2(triage.totRedReal + oa.overPayment);
    triage.nRedReal += 1;
  } else if (trim.triageBand === 'orange' && oa.overPayment > 1) {
    triage.totOrange = round2(triage.totOrange + oa.overPayment);
    triage.nOrange += 1;
  } else if (trim.triageBand === 'green' && oa.overPayment < -1) {
    triage.totGreenPay = round2(triage.totGreenPay + Math.abs(oa.overPayment));
    triage.nGreenPay += 1;
  } else if (trim.triageBand === 'blue') {
    triage.nBlueOk += 1;
  }
}
triage.saldoLiquido = round2(
  triage.totRedReal + triage.totOrange - triage.totGreenPay,
);

let totQtyRent = 0;
let totQtyDist = 0;
for (const pk of ctx.keysSorted) {
  if (isAggregateKey(pk)) continue;
  const pv = ctx.properties[pk];
  if (!pv) continue;
  totQtyRent += pv.qtyRentals || 0;
  totQtyDist += pv.qtyOwnerPmts || 0;
}

console.log('');
console.log('=== FASE 3 — TRIAGEM (recorte meses válidos) ===');
console.log('Último mês parcial excluído:', csvSpan.partialLastYm || '—');
console.log('Data máxima CSV:', csvSpan.maxDateStr || '—');
console.log('');
console.log('--- Resumo realista ---');
console.log('Saldo líquido (recorte): $', fmtUsd(triage.saldoLiquido));
console.log(
  'Vermelho descasamento real: $',
  fmtUsd(triage.totRedReal),
  '(',
  triage.nRedReal,
  ')',
);
console.log(
  'Laranja placement (6112): $',
  fmtUsd(triage.totOrange),
  '(',
  triage.nOrange,
  ')',
);
console.log(
  'Verde a pagar ao owner: $',
  fmtUsd(triage.totGreenPay),
  '(',
  triage.nGreenPay,
  ')',
);
console.log('Azul ok:', triage.nBlueOk);
console.log('Cinza a revisar:', triage.nRevisar);
console.log('Saldo bruto (sem recorte): $', fmtUsd(triage.brutoLiquido));
console.log('Qty lanç. 4100 (total):', totQtyRent);
console.log('Qty lanç. 3250 (total):', totQtyDist);
console.log('');

const topRedReal = triageRows
  .filter((r) => r.triageBand === 'red')
  .sort((a, b) => b.saldo - a.saldo)
  .slice(0, 8);
const topOrange = triageRows
  .filter((r) => r.triageBand === 'orange')
  .sort((a, b) => b.saldo - a.saldo)
  .slice(0, 5);

console.log('--- Amostra vermelho REAL (recorte) ---');
for (const r of topRedReal) {
  console.log(
    `  $${fmtUsd(r.saldo)} | ${r.pct}% | ${r.address || r.key.slice(0, 60)}`,
  );
}
console.log('');
console.log('--- Amostra laranja PLACEMENT ---');
for (const r of topOrange) {
  console.log(
    `  $${fmtUsd(r.saldo)} | ${r.pct}% | ${r.address || r.key.slice(0, 60)} (bruto $${fmtUsd(r.bruto)})`,
  );
}
