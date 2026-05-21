/**
 * FASE 1 — Mede taxa de acerto GL Property column ↔ Postgres properties (Manager Prop PROD).
 * Só leitura. Lógica de match: lib/tenantPaymentMatcher.ts (normalizeAddress + tokenSimilarity >= 0.6).
 *
 * USO: node scripts/qa-audit-match.mjs [caminho/general_ledger.csv]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import Papa from 'papaparse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CLIENT_ID = 'cmoqec9bw0000057uu4p5h15a';

// --- .env.local (DATABASE_URL_PRODUCTION) ---
function loadEnvLocal() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

// --- tenantPaymentMatcher (espelhado para reportar score) ---
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

/** @returns {{ propertyId: string, score: number, method: 'exact_part'|'token', address: string } | null} */
function matchPropertyWithMeta(paymentAddress, properties) {
  const parts = String(paymentAddress || '')
    .split(' - ')
    .map((x) => x.trim())
    .filter(Boolean);

  for (const part of parts) {
    const normalizedPart = normalizeAddress(part);
    const matches = properties.filter(
      (pr) => normalizeAddress(pr.address) === normalizedPart,
    );
    if (matches.length === 1) {
      const m = matches[0];
      return {
        propertyId: m.id,
        score: 1,
        method: 'exact_part',
        address: m.address,
      };
    }
  }

  let best = null;
  for (const prop of properties) {
    const score = tokenSimilarity(paymentAddress, prop.address);
    if (score >= 0.6 && (!best || score > best.score)) {
      best = { propertyId: prop.id, score, method: 'token', address: prop.address };
    }
  }
  return best;
}

// --- Extrair propertyKeys do GL (mesmas regras que gm-audit-2026.js) ---
function glHeader(txt) {
  const m = String(txt || '').match(/^\s*->\s*(\d{4})\s*-\s*(.+?)\s*$/);
  if (!m) return null;
  return { gl: m[1] };
}

function rowVal(row, keys) {
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

function extractDistinctPropertyKeys(csvText) {
  const p = Papa.parse(csvText.trim(), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader(h) {
      return String(h || '').trim();
    },
  });
  const rows = p.data || [];
  const keys = new Set();
  let curGl = '';

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    if (!row || typeof row !== 'object') continue;
    const pstr = String(rowVal(row, ['Property', 'property']) ?? '');
    const desc = String(rowVal(row, ['Description', 'description']) || '');
    const typeV = String(rowVal(row, ['Type', 'type']) || '');

    const gh = glHeader(pstr);
    if (gh) {
      curGl = gh.gl;
      continue;
    }
    if (/starting\s+balance/i.test(pstr) || /starting\s+balance/i.test(typeV + ' ' + desc))
      continue;

    const propTrim = pstr.trim();
    if (!propTrim || /^->/.test(propTrim)) continue;
    if (!curGl) continue;

    keys.add(propTrim);
  }
  return [...keys].sort((a, b) => a.localeCompare(b));
}

function fetchPropertiesProd(databaseUrl) {
  const sql =
    `SELECT id, address, "mgmtFeePct", "hoaAdmin" FROM properties WHERE "clientId" = '${CLIENT_ID}' ORDER BY address;`;
  const out = execSync(`psql "${databaseUrl}" -v ON_ERROR_STOP=1 -t -A -F '|' -c ${JSON.stringify(sql)}`, {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  const props = [];
  const lines = out.split('\n').filter((l) => l.trim());
  for (const line of lines) {
    const [id, address, mgmtFeePct, hoaAdmin] = line.split('|');
    if (!id) continue;
    props.push({
      id,
      address: address || '',
      mgmtFeePct: parseFloat(mgmtFeePct || '0') || 0,
      hoaAdmin: String(hoaAdmin).toLowerCase() === 't',
    });
  }
  return props;
}

function effectiveMgmtPct(prop) {
  const raw = Number(prop.mgmtFeePct) || 0;
  if (prop.hoaAdmin) return raw > 0 ? raw : 10;
  return raw > 0 ? raw : 8;
}

// --- main ---
const env = loadEnvLocal();
const databaseUrl = env.DATABASE_URL_PRODUCTION || env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL_PRODUCTION não definido em .env.local');
  process.exit(2);
}

const defaultCsv = path.join(process.env.HOME || '', 'Downloads/general_ledger-20260516.csv');
let csvArg = process.argv[2];
if (!csvArg) {
  csvArg = fs.existsSync(defaultCsv)
    ? defaultCsv
    : path.join(ROOT, 'general_ledger.csv');
}
if (!fs.existsSync(csvArg)) {
  console.error('CSV não encontrado:', csvArg);
  console.error('Sugestão: node scripts/qa-audit-match.mjs ~/Downloads/general_ledger-20260516.csv');
  process.exit(2);
}

const csvText = fs.readFileSync(csvArg, 'utf8');
const propertyKeys = extractDistinctPropertyKeys(csvText);
const dbProps = fetchPropertiesProd(databaseUrl);

const matched = [];
const unmatched = [];
const matchedPctZero = [];

for (const pk of propertyKeys) {
  const m = matchPropertyWithMeta(pk, dbProps);
  if (!m) {
    unmatched.push(pk);
    continue;
  }
  const prop = dbProps.find((p) => p.id === m.propertyId);
  const row = {
    propertyKey: pk,
    propertyId: m.propertyId,
    address: m.address,
    score: m.score,
    method: m.method,
    mgmtFeePct: prop ? prop.mgmtFeePct : 0,
    hoaAdmin: prop ? prop.hoaAdmin : false,
    effectivePct: prop ? effectiveMgmtPct(prop) : null,
  };
  matched.push(row);
  if (!prop || Number(prop.mgmtFeePct) === 0) {
    matchedPctZero.push(row);
  }
}

const total = propertyKeys.length;
const nMatched = matched.length;
const nUnmatched = unmatched.length;
const rate = total > 0 ? ((nMatched / total) * 100).toFixed(2) : '0.00';

console.log('=== Auditoria 2026 — QA match GL ↔ Properties (FASE 1) ===');
console.log('Cliente:', CLIENT_ID, '(Manager Prop PROD)');
console.log('CSV:', path.resolve(csvArg));
console.log('Properties no Postgres:', dbProps.length);
console.log('');

console.log('--- PASSO 2: Resumo ---');
console.log('Total propertyKeys no GL:', total);
console.log('Casaram:', nMatched, `(${rate}%)`);
console.log('NÃO casaram:', nUnmatched);
console.log('Casadas com mgmtFeePct = 0:', matchedPctZero.length);
console.log('');

if (unmatched.length) {
  console.log('--- NÃO casadas (lista completa) ---');
  for (const u of unmatched) console.log('  -', u);
  console.log('');
}

if (matchedPctZero.length) {
  console.log('--- Casadas com mgmtFeePct = 0 ---');
  for (const z of matchedPctZero) {
    console.log(
      `  - GL: ${z.propertyKey.slice(0, 80)}${z.propertyKey.length > 80 ? '…' : ''}`,
    );
    console.log(`    DB: ${z.address} | hoaAdmin=${z.hoaAdmin} | effectivePct(fallback)=${z.effectivePct}`);
  }
  console.log('');
}

console.log('--- Amostra 10 casadas (GL → Property + mgmtFeePct + score) ---');
const sample = matched
  .slice()
  .sort((a, b) => b.score - a.score)
  .slice(0, 10);
for (const s of sample) {
  console.log(`[${s.method} score=${s.score.toFixed(3)}]`);
  console.log(`  GL:     ${s.propertyKey}`);
  console.log(`  DB:     ${s.address}`);
  console.log(
    `  pct:    mgmtFeePct=${s.mgmtFeePct} hoaAdmin=${s.hoaAdmin} effective=${s.effectivePct}%`,
  );
  console.log('');
}

// PASSO 3 — regra HOA / default
const hoaAdminTrue = matched.filter((m) => m.hoaAdmin);
const hoaNot10 = hoaAdminTrue.filter((m) => Number(m.mgmtFeePct) !== 10);
const nonHoaZero = matched.filter((m) => !m.hoaAdmin && Number(m.mgmtFeePct) === 0);
const nonHoaEight = matched.filter((m) => !m.hoaAdmin && Number(m.mgmtFeePct) === 8);
const distinctPct = [...new Set(matched.map((m) => m.mgmtFeePct))].sort((a, b) => a - b);

console.log('--- PASSO 3: Regra do % (dados gravados vs fallback UI) ---');
console.log('Valores distintos mgmtFeePct nas casadas:', distinctPct.join(', '));
console.log('Casadas hoaAdmin=true:', hoaAdminTrue.length);
console.log('  destas, mgmtFeePct != 10:', hoaNot10.length);
if (hoaNot10.length && hoaNot10.length <= 15) {
  for (const x of hoaNot10) {
    console.log(`    - pct=${x.mgmtFeePct} | ${x.address}`);
  }
}
console.log('Casadas hoaAdmin=false e mgmtFeePct=0:', nonHoaZero.length);
console.log('Casadas hoaAdmin=false e mgmtFeePct=8:', nonHoaEight.length);
console.log('');
console.log(
  'Interpretação: mgmtFeePct é coluna explícita; hoaAdmin NÃO força 10 no DB automaticamente.',
);
console.log(
  'Na UI (ltpRecalcMgm), fallback é hoaAdmin→10, HOA toggle→10, senão 8 — só ao editar/gravar.',
);
console.log(
  'Para auditoria: usar mgmtFeePct se > 0; senão effective = hoaAdmin?10:8 (alinhar UI).',
);
