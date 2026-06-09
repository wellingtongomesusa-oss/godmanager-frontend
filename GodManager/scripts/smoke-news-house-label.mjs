/**
 * Smoke — News: houseLabel (endereço) em avisos de job + deep-link preservado.
 * Requer: next start :3101. Se API 500, valida com mock estrutural.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3101';
const __dir = dirname(fileURLToPath(import.meta.url));
const CHANNEL = 'chrome';

const MOCK_JOB_ID = 'smoke-house-label-' + Date.now();
const MOCK_PROP_CODE = 'P0018';
const MOCK_ADDRESS_FULL = '9028 Stinger Drive, Kissimmee, FL 34747';
const MOCK_ADDRESS_STREET = '9028 Stinger Drive';

function sessionCookieValue(userId, role) {
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  return Buffer.from(JSON.stringify({ userId, role, exp })).toString('base64');
}

let user;
try {
  user = JSON.parse(readFileSync(join(__dir, '.smoke-vendor-free-users.json'), 'utf8')).admin;
} catch {
  console.error('FAIL: .smoke-vendor-free-users.json');
  process.exit(1);
}

const results = { channel: CHANNEL, c1: null, c2: null, c3: null };

async function openPremium(page) {
  await page.goto(`${BASE}/GodManager_Premium.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(
    () =>
      typeof renderMsgs === 'function' &&
      typeof gmNewsResolveHouseLabel === 'function' &&
      typeof gmNewsOpenJob === 'function',
    { timeout: 60000 },
  );
}

function seedJobCache(page, jobId) {
  return page.evaluate(
    ({ jobId, propCode, address }) => {
      window.__jobsApiRowsCache = [
        {
          id: jobId,
          propertyCode: propCode,
          propAddress: address,
          _isPm: true,
          status: 'pending',
          statusPm: 'PENDING',
          serviceDate: '2099-06-01',
        },
      ];
      window.jobsFetchFromApi = function () {
        window.__jobsApiRowsCache = [
          {
            id: jobId,
            propertyCode: propCode,
            propAddress: address,
            _isPm: true,
            status: 'pending',
            statusPm: 'PENDING',
            serviceDate: '2099-06-01',
          },
        ];
        window.__jobsExpensesCache = window.__jobsApiRowsCache;
        window.__jobsExpensesCacheAt = Date.now();
        return Promise.resolve(window.__jobsApiRowsCache);
      };
    },
    { jobId, propCode: MOCK_PROP_CODE, address: MOCK_ADDRESS_FULL },
  );
}

// C1 — novo aviso com houseLabel + endereço visível + deep-link
try {
  const browser = await chromium.launch({ headless: true, channel: CHANNEL });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
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
  page.setDefaultTimeout(90000);
  await openPremium(page);
  await seedJobCache(page, MOCK_JOB_ID);

  const postMeta = await page.evaluate(
    async ({ jobId, street, propCode }) => {
      const payload = {
        type: 'job_action',
        subtype: 'vendor_fee',
        title: 'Smoke house label',
        jobId,
        metadata: { amount: 120, propertyCode: propCode, houseLabel: street },
      };
      const r = await fetch('/api/news', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      return { ok: r.ok, status: r.status, item: j?.item || null };
    },
    { jobId: MOCK_JOB_ID, street: MOCK_ADDRESS_STREET, propCode: MOCK_PROP_CODE },
  );

  await page.evaluate(
    ({ jobId, street, propCode, apiOk, apiItem }) => {
      window.__gmNewsApiItems = [
        apiOk && apiItem
          ? apiItem
          : {
              id: 'mock-' + jobId,
              subtype: 'vendor_fee',
              title: 'Smoke house label',
              jobId,
              metadata: { amount: 120, propertyCode: propCode, houseLabel: street },
              createdAt: new Date().toISOString(),
            },
      ];
      renderMsgs();
    },
    {
      jobId: MOCK_JOB_ID,
      street: MOCK_ADDRESS_STREET,
      propCode: MOCK_PROP_CODE,
      apiOk: postMeta.ok,
      apiItem: postMeta.item,
    },
  );

  const render = await page.evaluate(
    ({ street, propCode }) => {
      const list = document.getElementById('news-list');
      const html = list?.innerHTML || '';
      const spans = [...(list?.querySelectorAll('span[title]') || [])];
      const houseSpan = spans.find((s) => (s.getAttribute('title') || '').includes(street));
      return {
        showsStreet: html.includes(street),
        showsPropCode: html.includes(propCode),
        houseSpanTitle: houseSpan?.getAttribute('title') || null,
        hasOpenBtn: html.includes('Abrir job'),
      };
    },
    { street: MOCK_ADDRESS_STREET, propCode: MOCK_PROP_CODE },
  );

  await page.evaluate((jobId) => gmNewsOpenJob(jobId), MOCK_JOB_ID);
  await page.waitForFunction(
    () => document.getElementById('page-jobs')?.classList.contains('active'),
    { timeout: 30000 },
  );
  await page.waitForTimeout(2200);

  const deeplink = await page.evaluate((jobId) => ({
    dateFilter: window.__jobsDateFilter,
    rowFound: !!document.querySelector('tr[data-job-id="' + jobId + '"]'),
    highlighted:
      !!document.querySelector('tr.gm-job-deeplink-highlight') ||
      !!document.querySelector('tr[data-job-id="' + jobId + '"]')?.style?.background,
  }), MOCK_JOB_ID);

  results.c1 = {
    ok:
      render.showsStreet &&
      !render.showsPropCode &&
      render.hasOpenBtn &&
      deeplink.dateFilter === 'all' &&
      deeplink.rowFound,
    usedMock: !postMeta.ok,
    apiStatus: postMeta.status,
    render,
    deeplink,
  };
  await browser.close();
} catch (e) {
  results.c1 = { ok: false, error: e.message };
}

// C2 — aviso antigo só propertyCode: fallback endereço ou código
try {
  const browser = await chromium.launch({ headless: true, channel: CHANNEL });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
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
  await openPremium(page);

  const withCache = await page.evaluate(
    ({ jobId, propCode, street, address }) => {
      window.__jobsApiRowsCache = [
        { id: jobId, propertyCode: propCode, propAddress: address, _isPm: true },
      ];
      window.__gmNewsApiItems = [
        {
          id: 'legacy-1',
          subtype: 'vendor_fee',
          title: 'Legacy aviso',
          jobId,
          metadata: { propertyCode: propCode },
          createdAt: new Date().toISOString(),
        },
      ];
      renderMsgs();
      const html = document.getElementById('news-list')?.innerHTML || '';
      return {
        showsStreet: html.includes(street),
        showsPropCodeOnly: html.includes(propCode) && !html.includes(street),
        resolved: gmNewsResolveHouseLabel({
          jobId,
          metadata: { propertyCode: propCode },
        }),
      };
    },
    {
      jobId: 'legacy-job-1',
      propCode: MOCK_PROP_CODE,
      street: MOCK_ADDRESS_STREET,
      address: MOCK_ADDRESS_FULL,
    },
  );

  const withoutCache = await page.evaluate(
    ({ jobId, propCode }) => {
      window.__jobsApiRowsCache = [];
      window.__gmNewsApiItems = [
        {
          id: 'legacy-2',
          subtype: 'vendor_fee',
          title: 'Legacy sem cache',
          jobId,
          metadata: { propertyCode: propCode },
          createdAt: new Date().toISOString(),
        },
      ];
      renderMsgs();
      const html = document.getElementById('news-list')?.innerHTML || '';
      return {
        showsPropCode: html.includes(propCode),
        resolved: gmNewsResolveHouseLabel({ jobId, metadata: { propertyCode: propCode } }),
      };
    },
    { jobId: 'legacy-job-missing', propCode: MOCK_PROP_CODE },
  );

  results.c2 = {
    ok:
      withCache.showsStreet &&
      withCache.resolved === MOCK_ADDRESS_STREET &&
      withoutCache.showsPropCode &&
      withoutCache.resolved === MOCK_PROP_CODE,
    withCache,
    withoutCache,
  };
  await browser.close();
} catch (e) {
  results.c2 = { ok: false, error: e.message };
}

// C3 — manual inalterado + sem escrita properties/tenants
try {
  const browser = await chromium.launch({ headless: true, channel: CHANNEL });
  const context = await browser.newContext();
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
  await openPremium(page);

  const c3 = await page.evaluate(async () => {
    window.__gmNewsApiItems = [];
    localStorage.setItem(
      'mp_msgs',
      JSON.stringify([
        {
          id: Date.now(),
          text: 'Manual smoke intacto',
          type: 'normal',
          time: '20/05/2026',
          reads: 0,
        },
      ]),
    );
    renderMsgs();
    const list = document.getElementById('news-list');
    const html = list?.innerHTML || '';
    const noWrite = (status) => status !== 200 && status !== 201 && status !== 204;
    const propPatch = await fetch('/api/properties/fake-id', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: 'x' }),
    }).catch(() => ({ status: 0 }));
    const tenantPatch = await fetch('/api/tenants/fake-id', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'x' }),
    }).catch(() => ({ status: 0 }));
    return {
      hasManualText: html.includes('Manual smoke intacto'),
      hasOpenJob: html.includes('Abrir job'),
      hasHouseTag: html.includes('9028 Stinger Drive'),
      clickable: !!list?.querySelector('[onclick*="markRead"]'),
      noPropertyWrite: noWrite(propPatch.status || 0),
      noTenantWrite: noWrite(tenantPatch.status || 0),
    };
  });

  results.c3 = {
    ok:
      c3.hasManualText &&
      !c3.hasOpenJob &&
      !c3.hasHouseTag &&
      c3.clickable &&
      c3.noPropertyWrite &&
      c3.noTenantWrite,
    c3,
  };
  await browser.close();
} catch (e) {
  results.c3 = { ok: false, error: e.message };
}

const pass = results.c1?.ok && results.c2?.ok && results.c3?.ok;
console.log(JSON.stringify({ pass, ...results }, null, 2));
process.exit(pass ? 0 : 1);
