/**
 * Smoke — Exportar CSV na tela Properties (#page-ltproperties).
 */
import { chromium } from 'playwright';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3101';
const MP_CLIENT_ID = 'cmoqec9bw0000057uu4p5h15a';
const MVH_CLIENT_ID = 'cmpejrwoe000ap64xkegrzsho';
const DEFAULT_MP_USER_ID = 'cmobuxca50000p81wp4llstd7';
const DEFAULT_MVH_USER_ID = 'cmpejrwom000cp64xktfc5skl';

const REQUIRED_HEADERS = [
  '#',
  'ENDERECO',
  'OWNER',
  'TENANT',
  'QUARTOS',
  'BANHEIROS',
  'SQFT',
  'MOVE IN',
  'OCUPACAO',
  'STATUS AUTO',
  'RENT',
  'DEPOSIT',
  'RESERVA DE SEGURANCA',
  'MGM %',
  'TENANT PLACE',
  'NET OWNER',
  'EXP MES (PM)',
  'MES',
  'STATUS',
];

function sessionCookieValue(userId, role) {
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  return Buffer.from(JSON.stringify({ userId, role, exp })).toString('base64');
}

function parseCsv(text) {
  const raw = text.replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = lines[0].split(',');
  const rows = lines.slice(1).map((line) => {
    const cols = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') inQ = false;
        else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ',') {
        cols.push(cur);
        cur = '';
      } else cur += ch;
    }
    cols.push(cur);
    return cols;
  });
  return { headers, rows };
}

function idx(headers, name) {
  return headers.indexOf(name);
}

const errors = [];

async function exportOnProperties(page, label, afterLoad) {
  page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));

  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (/\/api\/(properties|pm\/expenses|auth|tenants)/.test(url)) {
      await route.continue();
      return;
    }
    const method = route.request().method();
    if (method === 'GET' || method === 'HEAD') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, properties: [], expenses: [], items: [] }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto(`${BASE}/GodManager_Premium.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(600);

  await page.evaluate(async () => {
    try {
      if (typeof gmPropertiesFetchFromApi === 'function') {
        const fresh = await gmPropertiesFetchFromApi();
        if (fresh?.length && typeof gmPropertiesSave === 'function') gmPropertiesSave(fresh);
      }
    } catch (e) {
      /* ignore */
    }
    if (typeof nav === 'function') nav('ltproperties');
    await new Promise((r) => setTimeout(r, 80));
    if (typeof ltpRender === 'function') await ltpRender();
  });
  if (afterLoad) await afterLoad(page);
  await page.waitForTimeout(2500);

  const counts = await page.evaluate(() => {
    const total = document.getElementById('ltp-kpi-total');
    const counter = document.getElementById('ltp-counter');
    return {
      portfolioTotal: Number(String(total?.textContent || '').replace(/[^\d]/g, '') || 0),
      tableFiltered: Number(String(counter?.textContent || '').replace(/[^\d]/g, '') || 0),
    };
  });

  const exportPayload = await page.evaluate(async () => {
    if (typeof ltpExportCsv === 'function') await ltpExportCsv();
    return window.__ltpLastExportCsv || null;
  });
  if (!exportPayload?.csv) {
    throw new Error(`${label}: export CSV vazio (ltpExportCsv nao gravou __ltpLastExportCsv)`);
  }
  const fname = exportPayload.fname;
  const parsed = parseCsv(exportPayload.csv);

  return { fname, parsed, ...counts };
}

async function runUser(user, label, extraSetup) {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PW_CHROME_CHANNEL || 'chrome',
  });
  const context = await browser.newContext();
  await context.addInitScript(
    ({ userId, role, clientId }) => {
      window.__gmCurrentUser = { id: userId, role, email: 'smoke@test.com', status: 'active', clientId };
    },
    { userId: user.id, role: user.role, clientId: user.clientId },
  );
  await context.addCookies([
    {
      name: 'gm_auth',
      value: sessionCookieValue(user.id, user.role),
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  const page = await context.newPage();
  page.setDefaultTimeout(120000);
  page.on('dialog', async (d) => {
    await d.dismiss();
  });

  const result = await exportOnProperties(page, label, extraSetup);
  await browser.close();
  return result;
}

const today = new Date().toISOString().slice(0, 10);

const mpUser = {
  id: DEFAULT_MP_USER_ID,
  role: 'admin',
  clientId: MP_CLIENT_ID,
};
const mvhUser = {
  id: DEFAULT_MVH_USER_ID,
  role: 'admin',
  clientId: MVH_CLIENT_ID,
};

const mpAll = await runUser(mpUser, 'mp-all', null);

const mpVg = await runUser(mpUser, 'mp-vg', async (page) => {
  await page.evaluate(async () => {
    const sel = document.getElementById('ltp-filter-occ');
    if (sel) sel.value = 'VG';
    if (typeof ltpRender === 'function') await ltpRender();
  });
});

const mpKiss = await runUser(mpUser, 'mp-kiss', async (page) => {
  await page.evaluate(async () => {
    const sel = document.getElementById('ltp-filter-occ');
    if (sel) sel.value = '';
    const search = document.getElementById('ltp-search');
    if (search) search.value = 'Kissimmee';
    if (typeof ltpRender === 'function') await ltpRender();
  });
});

const mvhAll = await runUser(mvhUser, 'mvh-all', null);

function analyzeExport(tag, data, extraChecks) {
  const { fname, parsed, portfolioTotal, tableFiltered } = data;
  const expectRowCount = tableFiltered;
  const headers = parsed.headers;
  const rows = parsed.rows;
  const iAddr = idx(headers, 'ENDERECO');
  const iDep = idx(headers, 'DEPOSIT');
  const iRes = idx(headers, 'RESERVA DE SEGURANCA');
  const iMgm = idx(headers, 'MGM %');
  const iTp = idx(headers, 'TENANT PLACE');
  const iNet = idx(headers, 'NET OWNER');
  const iExp = idx(headers, 'EXP MES (PM)');
  const iAuto = idx(headers, 'STATUS AUTO');
  const allHeadersOk = REQUIRED_HEADERS.every((h) => headers.includes(h));
  const depositPresent = rows.some((r) => r[iDep] && r[iDep] !== '');
  const kissimmeeOnly =
    extraChecks?.kissimmeeOnly &&
    rows.every((r) => String(r[iAddr] || '').toLowerCase().includes('kissimmee'));
  const vgOnly =
    extraChecks?.vgOnly &&
    rows.every((r) => {
      const auto = String(r[iAuto] || '').trim();
      return auto === 'VG';
    });
  return {
    fname,
    rowCount: rows.length,
    headerCount: headers.length,
    portfolioTotal,
    tableFiltered,
    checks: {
      filename: fname === `GM_Properties_${today}.csv`,
      nineteenCols: headers.length === 19,
      allHeadersOk,
      rowCountOk: rows.length === expectRowCount,
      matchesTableCounter: rows.length === tableFiltered,
      depositPresent,
      reservaCol: iRes >= 0,
      mgmCol: iMgm >= 0,
      tenantPlaceCol: iTp >= 0,
      netOwnerCol: iNet >= 0,
      expPmCol: iExp >= 0,
      statusAutoCol: iAuto >= 0,
      kissimmeeOnly: extraChecks?.kissimmeeOnly ? kissimmeeOnly : true,
      vgOnly: extraChecks?.vgOnly ? vgOnly : true,
    },
  };
}

const mpAllA = analyzeExport('mp-all', mpAll);
mpAllA.checks.mpPortfolio110 = mpAll.portfolioTotal === 110;

const mpVgA = analyzeExport('mp-vg', mpVg, { vgOnly: true });
const mpKissA = analyzeExport('mp-kiss', mpKiss, { kissimmeeOnly: true });
const mvhA = analyzeExport('mvh-all', mvhAll);
mvhA.checks.mvhScopedOnly =
  mvhAll.portfolioTotal <= 20 && mvhAll.parsed.rows.length === mvhAll.tableFiltered;

const summary = {
  today,
  mpAll: mpAllA,
  mpVg: mpVgA,
  mpKiss: mpKissA,
  mvhAll: mvhA,
  errors,
  pass:
    Object.values(mpAllA.checks).every(Boolean) &&
    Object.values(mpVgA.checks).every(Boolean) &&
    Object.values(mpKissA.checks).every(Boolean) &&
    Object.values(mvhA.checks).every(Boolean) &&
    mpAllA.checks.mpPortfolio110 &&
    mvhA.checks.mvhScopedOnly &&
    errors.length === 0,
};

console.log(JSON.stringify(summary, null, 2));
process.exit(summary.pass ? 0 : 1);
