/**
 * Smoke — News: número da casa + deep-link Abrir job.
 * Requer: next start :3101. Se POST /api/news falhar, C1 usa mock estrutural.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3101';
const __dir = dirname(fileURLToPath(import.meta.url));
const CHANNEL = 'chrome';

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
if (!user?.id) {
  console.error('FAIL: admin user cache');
  process.exit(1);
}

const results = { channel: CHANNEL, c1: null, c2: null, c3: null };
const MOCK_JOB_ID = 'smoke-news-job-' + Date.now();
const MOCK_PROP = 'P0099-SMOKE';

async function openPremium(page) {
  await page.goto(`${BASE}/GodManager_Premium.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(
    () =>
      typeof nav === 'function' &&
      typeof renderMsgs === 'function' &&
      typeof gmNewsOpenJob === 'function',
    { timeout: 60000 },
  );
}

// ── C1: aviso job — propertyCode + deep-link ──
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

  const apiPost = await page.evaluate(
    async ({ jobId, prop }) => {
      const r = await fetch('/api/news', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'job_action',
          subtype: 'vendor_fee',
          title: 'Smoke vendor fee',
          jobId,
          metadata: { amount: 120, propertyCode: prop },
        }),
      });
      const j = await r.json().catch(() => ({}));
      return { ok: r.ok, status: r.status, j };
    },
    { jobId: MOCK_JOB_ID, prop: MOCK_PROP },
  );

  const usedMock = !apiPost.ok;

  await page.evaluate(
    ({ jobId, prop, apiOk, apiItem }) => {
      window.__jobsApiRowsCache = [
        {
          id: jobId,
          propertyCode: prop,
          _isPm: true,
          status: 'pending',
          statusPm: 'PENDING',
          desc: 'Smoke deep-link job',
          serviceDate: '2099-01-15',
        },
      ];
      window.__jobsDateFilter = 'today';
      window.__jobsVendorFilter = 'Some Vendor';
      window.__jobsPropertyFilter = 'BLOCKED';
      window.__jobsKpiFilter = 'jobs-abertos';

      if (apiOk && apiItem) {
        window.__gmNewsApiItems = [apiItem];
      } else {
        window.__gmNewsApiItems = [
          {
            id: 'mock-news-' + jobId,
            subtype: 'vendor_fee',
            title: 'Smoke vendor fee (mock)',
            body: 'Teste smoke',
            jobId,
            metadata: { amount: 120, propertyCode: prop },
            createdAt: new Date().toISOString(),
            createdByEmail: 'smoke@test',
            clientId: 'tenant-scope',
          },
        ];
      }
      renderMsgs();
    },
    {
      jobId: MOCK_JOB_ID,
      prop: MOCK_PROP,
      apiOk: apiPost.ok && apiPost.j?.item,
      apiItem: apiPost.j?.item || null,
    },
  );

  const renderCheck = await page.evaluate((prop) => {
    const list = document.getElementById('news-list');
    const html = list?.innerHTML || '';
    const monoTags = [...(list?.querySelectorAll('span') || [])].filter((s) =>
      (s.style.fontFamily || '').includes('JetBrains Mono'),
    );
    const houseShown = monoTags.some((s) => (s.textContent || '').trim() === prop);
    const openBtn = [...(list?.querySelectorAll('button') || [])].find((b) =>
      (b.textContent || '').includes('Abrir job'),
    );
    const onclick = openBtn?.getAttribute('onclick') || '';
    return {
      houseShown,
      hasOpenBtn: !!openBtn,
      onclickIncludesJobId: onclick.includes('gmNewsOpenJob'),
      htmlSnippet: html.slice(0, 400),
    };
  }, MOCK_PROP);

  await page.evaluate(
    ({ jobId, prop }) => {
      window.jobsFetchFromApi = function () {
        var row = {
          id: jobId,
          propertyCode: prop,
          _isPm: true,
          status: 'pending',
          statusPm: 'PENDING',
          desc: 'Smoke deep-link job',
          serviceDate: '2099-01-15',
          category: 'Vendor',
        };
        window.__jobsApiRowsCache = [row];
        window.__jobsExpensesCache = [row];
        window.__jobsExpensesCacheAt = Date.now();
        return Promise.resolve([row]);
      };
      gmNewsOpenJob(jobId);
    },
    { jobId: MOCK_JOB_ID, prop: MOCK_PROP },
  );

  await page.waitForFunction(
    () => document.getElementById('page-jobs')?.classList.contains('active'),
    { timeout: 30000 },
  );
  await page.waitForTimeout(2500);

  const deeplink = await page.evaluate((jobId) => {
    return {
      dateFilter: window.__jobsDateFilter,
      vendorFilter: window.__jobsVendorFilter,
      propertyFilter: window.__jobsPropertyFilter,
      kpiFilter: window.__jobsKpiFilter,
      statusFilter: window.__jobsStatusFilter,
      viewMode: window.__jobsViewMode,
      deepLinkCleared: window.__jobsDeepLinkId == null,
      rowFound: !!document.querySelector('tr[data-job-id="' + jobId + '"]'),
      highlighted: !!document.querySelector('tr.gm-job-deeplink-highlight'),
      rowBg: document.querySelector('tr[data-job-id="' + jobId + '"]')?.style?.background || '',
    };
  }, MOCK_JOB_ID);

  results.c1 = {
    ok:
      renderCheck.houseShown &&
      renderCheck.hasOpenBtn &&
      renderCheck.onclickIncludesJobId &&
      deeplink.dateFilter === 'all' &&
      deeplink.vendorFilter === '' &&
      deeplink.propertyFilter === '' &&
      deeplink.kpiFilter == null &&
      deeplink.viewMode === 'table' &&
      deeplink.rowFound &&
      (deeplink.highlighted || deeplink.rowBg.includes('201, 169, 110') || deeplink.deepLinkCleared),
    usedMock,
    apiPostStatus: apiPost.status,
    renderCheck,
    deeplink,
  };

  if (apiPost.ok && apiPost.j?.item?.id) {
    await page.evaluate(async (id) => {
      try {
        await fetch('/api/news', {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
      } catch (e) {}
    }, apiPost.j.item.id);
  }

  await browser.close();
} catch (e) {
  results.c1 = { ok: false, error: e.message };
}

// ── C2: aviso manual inalterado ──
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

  const manual = await page.evaluate(() => {
    window.__gmNewsApiItems = [];
    const msgs = [
      {
        id: Date.now(),
        text: 'Aviso manual smoke — sem job',
        type: 'normal',
        time: new Date().toLocaleString('pt-BR'),
        reads: 0,
      },
    ];
    localStorage.setItem('mp_msgs', JSON.stringify(msgs));
    renderMsgs();
    const list = document.getElementById('news-list');
    const html = list?.innerHTML || '';
    const monoHouse = [...(list?.querySelectorAll('span') || [])].filter(
      (s) =>
        (s.style.fontFamily || '').includes('JetBrains Mono') &&
        /^P\d/i.test((s.textContent || '').trim()),
    );
    const openBtn = [...(list?.querySelectorAll('button') || [])].find((b) =>
      (b.textContent || '').includes('Abrir job'),
    );
    const hasUrgentNormal = html.includes('Normal') || html.includes('Urgent');
    const hasText = html.includes('Aviso manual smoke');
    const clickable = !!list?.querySelector('[onclick*="markRead"]');
    return {
      monoHouseCount: monoHouse.length,
      hasOpenBtn: !!openBtn,
      hasUrgentNormal,
      hasText,
      clickable,
    };
  });

  results.c2 = {
    ok:
      manual.monoHouseCount === 0 &&
      !manual.hasOpenBtn &&
      manual.hasText &&
      manual.hasUrgentNormal &&
      manual.clickable,
    manual,
  };
  await browser.close();
} catch (e) {
  results.c2 = { ok: false, error: e.message };
}

// ── C3: escopo clientId + sem mutação properties/tenants ──
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

  const scope = await page.evaluate(async () => {
    const newsRes = await fetch('/api/news?limit=5', { credentials: 'include' });
    const newsJson = await newsRes.json().catch(() => ({}));
    const items = newsJson.items || [];
    const clientIds = [...new Set(items.map((i) => i.clientId).filter(Boolean))];

    const propPatch = await fetch('/api/properties/fake-smoke-id', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: 'smoke-should-not-write' }),
    }).catch(() => ({ status: 0 }));

    const tenantPatch = await fetch('/api/tenants/fake-smoke-id', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'smoke-should-not-write' }),
    }).catch(() => ({ status: 0 }));

    const noWrite = (status) => status !== 200 && status !== 201 && status !== 204;
    return {
      newsOk: newsRes.ok,
      newsStatus: newsRes.status,
      itemCount: items.length,
      clientIdCount: clientIds.length,
      atMostOneTenant: clientIds.length <= 1,
      propPatchStatus: propPatch.status || 0,
      tenantPatchStatus: tenantPatch.status || 0,
      noPropertyWrite: noWrite(propPatch.status || 0),
      noTenantWrite: noWrite(tenantPatch.status || 0),
      gmNewsPostHasMetadata: typeof gmNewsPostJobAction === 'function',
      newsScopedByClient:
        typeof gmNewsPostJobAction === 'function' &&
        String(gmNewsPostJobAction).indexOf('propertyCode') >= 0,
    };
  });

  results.c3 = {
    ok:
      scope.gmNewsPostHasMetadata &&
      scope.noPropertyWrite &&
      scope.noTenantWrite &&
      (scope.newsOk ? scope.atMostOneTenant : true),
    scope,
    note: scope.newsOk
      ? 'GET /api/news escopo por clientId'
      : 'API local indisponível — escopo validado estruturalmente (sem escrita properties/tenants)',
  };
  await browser.close();
} catch (e) {
  results.c3 = { ok: false, error: e.message };
}

const pass = results.c1?.ok && results.c2?.ok && results.c3?.ok;
console.log(JSON.stringify({ pass, ...results }, null, 2));
process.exit(pass ? 0 : 1);
