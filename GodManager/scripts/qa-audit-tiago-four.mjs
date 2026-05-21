/**
 * Recalcula 4 imóveis Tiago (owner statement jan–mai) — espelha gm-audit-2026.js pós-ajuste:
 * todos os meses do CSV + agrupamento A/B antes do cálculo mensal.
 * USO: node scripts/qa-audit-tiago-four.mjs [general_ledger.csv]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import Papa from 'papaparse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CLIENT_ID = 'cmoqec9bw0000057uu4p5h15a';

const TARGETS = [
  { label: '221 Celebration', re: /221\s+celebration/i },
  { label: '2693 Armstrong (A+B)', re: /2693\s+armstrong/i, grouped: true },
  { label: '7762 Syracuse', re: /7762\s+syracuse/i },
  { label: '241 Lasso', re: /241\s+lasso/i },
];

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
        exp67Ex611: 0,
        net4100c: 0,
        debit3250: 0,
        qtyRentals: 0,
        qtyOwnerPmts: 0,
      };
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
      curName = gh.name;
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
      date: String(dateKey(row) || '').trim(),
      debit,
      credit,
    };
    blob.txs.push(tx);
    const g = curGl;
    if (/^4/.test(g)) blob.income4 = round2(blob.income4 + credit - debit);
    if (/^6|^7/.test(g) && g !== '6111') blob.exp67Ex611 = round2(blob.exp67Ex611 + debit);
    if (g === '4100') {
      blob.net4100c = round2(blob.net4100c + credit - debit);
      if (credit > 0.009) blob.qtyRentals += 1;
    }
    if (g === '3250') {
      blob.debit3250 = round2(blob.debit3250 + debit);
      blob.qtyOwnerPmts += 1;
    }
  }

  const keysSorted = propOrder.slice().sort((a, b) => a.localeCompare(b));
  const enriched = {};
  for (const key of keysSorted) {
    const pb = properties[key];
    enriched[key] = {
      txs: pb.txs,
      income4: pb.income4,
      rent4100: pb.net4100c,
      dist3250: pb.debit3250,
      ownerAuditExpenseEx611: round2(pb.exp67Ex611),
      qtyRentals: pb.qtyRentals,
      qtyOwnerPmts: pb.qtyOwnerPmts,
    };
  }
  return { properties: enriched, keysSorted };
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

function pickBaseMemberKey(memberKeys) {
  for (const pk of memberKeys) {
    if (!extractUnitSuffix(pk)) return pk;
  }
  return [...memberKeys].sort()[0];
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
  let head = ownerGlHeadSegment(pickBaseMemberKey(memberKeys));
  head = head
    .replace(/\s+#\s*[AB]\s*$/i, '')
    .replace(/\s*#\s*[AB]\s*$/i, '')
    .replace(/\s+unit\s*[AB]\s*$/i, '')
    .replace(/\s*\(unit\s*[AB]\)\s*$/i, '')
    .replace(/\s*\([AB]\)\s*$/i, '')
    .trim();
  return suffixes.length ? `${head} (${suffixes.join('+')})` : `${head} (${memberKeys.length} un.)`;
}

function mergeProperties(memberKeys, ctx) {
  const merged = {
    txs: [],
    income4: 0,
    rent4100: 0,
    dist3250: 0,
    ownerAuditExpenseEx611: 0,
    qtyRentals: 0,
    qtyOwnerPmts: 0,
  };
  for (const pk of memberKeys) {
    const pv = ctx.properties[pk];
    if (!pv) continue;
    merged.txs = merged.txs.concat(pv.txs || []);
    merged.income4 = round2(merged.income4 + Number(pv.income4 || 0));
    merged.rent4100 = round2(merged.rent4100 + Number(pv.rent4100 || 0));
    merged.dist3250 = round2(merged.dist3250 + Number(pv.dist3250 || 0));
    merged.ownerAuditExpenseEx611 = round2(
      merged.ownerAuditExpenseEx611 + Number(pv.ownerAuditExpenseEx611 || 0),
    );
    merged.qtyRentals += Number(pv.qtyRentals || 0);
    merged.qtyOwnerPmts += Number(pv.qtyOwnerPmts || 0);
  }
  return merged;
}

function buildWorkUnits(keys) {
  const byBase = {};
  for (const pk of keys) {
    const bk = baseGroupKey(pk);
    if (!byBase[bk]) byBase[bk] = [];
    byBase[bk].push(pk);
  }
  return Object.keys(byBase)
    .sort()
    .map((bk) => {
      const members = byBase[bk].slice().sort();
      return {
        displayKey: members.length === 1 ? members[0] : groupDisplayLabel(members),
        memberKeys: members,
      };
    });
}

function ownerMonthBuckets(pv) {
  const months = {};
  for (const tx of pv.txs || []) {
    const ym = parseYmFromAppfolioDate(tx.date);
    if (!ym) continue;
    if (!months[ym]) months[ym] = { income4: 0, rent4100: 0, expEx611: 0, dist3250: 0 };
    const m = months[ym];
    const g = tx.gl;
    if (/^4/.test(g))
      m.income4 = round2(m.income4 + Number(tx.credit || 0) - Number(tx.debit || 0));
    if (g === '4100')
      m.rent4100 = round2(m.rent4100 + Number(tx.credit || 0) - Number(tx.debit || 0));
    if (/^6|^7/.test(g) && g !== '6111') m.expEx611 = round2(m.expEx611 + tx.debit);
    if (g === '3250') m.dist3250 = round2(m.dist3250 + tx.debit);
  }
  return months;
}

function computeOwnerAuditDistRow(pv, pct) {
  const income = Number(pv.income4 || 0);
  const rent = Number(pv.rent4100 || 0);
  const distribuido = Number(pv.dist3250 || 0);
  const despEx = Number(pv.ownerAuditExpenseEx611 || 0);
  const feeDevido = round2((pct / 100) * rent);
  const netDevido = round2(income - feeDevido - despEx);
  const saldo = round2(distribuido - netDevido);
  return { income, rent, feeDevido, despesas: despEx, netDevido, distribuido, saldo };
}

function computeOwnerTrimmedAudit(pv, pct) {
  const buckets = ownerMonthBuckets(pv);
  const sum = { income4: 0, rent4100: 0, dist3250: 0, ownerAuditExpenseEx611: 0 };
  const excludedOrphan = [];
  for (const ym of Object.keys(buckets).sort()) {
    const m = buckets[ym];
    const orphan = m.dist3250 > 0.01 && m.income4 < 0.01;
    if (orphan) {
      excludedOrphan.push(ym);
      continue;
    }
    sum.income4 = round2(sum.income4 + m.income4);
    sum.rent4100 = round2(sum.rent4100 + m.rent4100);
    sum.dist3250 = round2(sum.dist3250 + m.dist3250);
    sum.ownerAuditExpenseEx611 = round2(sum.ownerAuditExpenseEx611 + m.expEx611);
  }
  const oa = computeOwnerAuditDistRow(
    {
      income4: sum.income4,
      rent4100: sum.rent4100,
      dist3250: sum.dist3250,
      ownerAuditExpenseEx611: sum.ownerAuditExpenseEx611,
    },
    pct,
  );
  return { oa, excludedOrphan, validMonths: Object.keys(buckets).sort().filter((ym) => !excludedOrphan.includes(ym)) };
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
      return { prop: matches[0], score: 1, method: 'exact_part' };
    }
  }
  let best = null;
  for (const prop of properties) {
    const score = tokenSimilarity(paymentAddress, prop.address);
    if (score >= 0.6 && (!best || score > best.score)) best = { prop, score, method: 'token' };
  }
  return best;
}

function fetchPropertiesProd(databaseUrl) {
  const sql = `SELECT id, address, "mgmtFeePct" FROM properties WHERE "clientId" = '${CLIENT_ID}' ORDER BY address;`;
  const out = execSync(`psql "${databaseUrl}" -v ON_ERROR_STOP=1 -t -A -F '|' -c ${JSON.stringify(sql)}`, {
    encoding: 'utf8',
  });
  return out
    .split('\n')
    .filter((l) => l.trim())
    .map((line) => {
      const [id, address, mgmtFeePct] = line.split('|');
      return { id, address: address || '', mgmtFeePct: parseFloat(mgmtFeePct || '0') || 0 };
    });
}

function detectCsvMonthSpan(ctx) {
  const months = new Set();
  for (const pk of ctx.keysSorted) {
    const pv = ctx.properties[pk];
    if (!pv) continue;
    for (const tx of pv.txs || []) {
      const ym = parseYmFromAppfolioDate(tx.date);
      if (ym) months.add(ym);
    }
  }
  const sorted = [...months].sort();
  return { first: sorted[0] || null, last: sorted[sorted.length - 1] || null, months: sorted };
}

const env = loadEnvLocal();
const databaseUrl = env.DATABASE_URL_PRODUCTION || env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL ausente em .env.local');
  process.exit(2);
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
const dbProps = fetchPropertiesProd(databaseUrl);
const span = detectCsvMonthSpan(ctx);
const keys = ctx.keysSorted.filter((k) => !/^->\s*\d{4}/i.test(k) && !/^starting\s+balance/i.test(k));
const units = buildWorkUnits(keys);

console.log('=== Auditoria Owner — 4 imóveis Tiago (recorte UI) ===');
console.log('CSV:', path.resolve(csvArg));
console.log(
  `Período arquivo: ${span.first || '—'} a ${span.last || '—'} (${span.months.length} meses)`,
);
console.log('');

for (const target of TARGETS) {
  const unit = units.find((u) => {
    if (target.grouped) {
      return u.memberKeys.length >= 2 && target.re.test(u.displayKey);
    }
    return target.re.test(u.displayKey) || u.memberKeys.some((mk) => target.re.test(mk));
  });
  if (!unit) {
    console.log(`--- ${target.label}: NÃO ENCONTRADO ---\n`);
    continue;
  }
  const basePk = pickBaseMemberKey(unit.memberKeys);
  const meta = matchPropertyWithMeta(basePk, dbProps);
  const pct = meta ? round2(meta.prop.mgmtFeePct) : null;
  if (pct == null || pct < 1 || pct > 20) {
    console.log(`--- ${target.label}: % inválido (${pct}) ---\n`);
    continue;
  }
  const pv =
    unit.memberKeys.length === 1
      ? ctx.properties[unit.memberKeys[0]]
      : mergeProperties(unit.memberKeys, ctx);
  const trim = computeOwnerTrimmedAudit(pv, pct);
  const oa = trim.oa;
  console.log(`--- ${target.label} ---`);
  console.log('  Linha UI:', unit.displayKey);
  if (unit.memberKeys.length > 1) {
    console.log('  Unidades GL:', unit.memberKeys.join(' | '));
    const pcts = new Set(
      unit.memberKeys
        .map((mk) => {
          const m = matchPropertyWithMeta(mk, dbProps);
          return m ? round2(m.prop.mgmtFeePct) : null;
        })
        .filter((x) => x != null && x >= 1 && x <= 20),
    );
    if (pcts.size > 1) console.log('  AVISO: % diferente entre unidades:', [...pcts].join(', '));
  }
  console.log('  % Properties:', pct + '%');
  console.log('  Meses válidos:', trim.validMonths.join(', '));
  if (trim.excludedOrphan.length) console.log('  Meses órfãos excluídos:', trim.excludedOrphan.join(', '));
  console.log('  income4 (líquido 4xxx):  $', fmtUsd(oa.income));
  console.log('  rent4100 (líquido 4100):   $', fmtUsd(oa.rent));
  console.log('  feeDevido:    $', fmtUsd(oa.feeDevido), `(${pct}% × rent4100)`);
  console.log('  despesas:     $', fmtUsd(oa.despesas));
  console.log('  netDevido:    $', fmtUsd(oa.netDevido));
  console.log('  dist3250:     $', fmtUsd(oa.distribuido));
  console.log('  saldo:        $', fmtUsd(oa.saldo), oa.saldo > 1 ? '[vermelho]' : oa.saldo < -1 ? '[verde]' : '[azul]');
  console.log('  qty 4100/3250:', pv.qtyRentals, '/', pv.qtyOwnerPmts);
  console.log('');
}
