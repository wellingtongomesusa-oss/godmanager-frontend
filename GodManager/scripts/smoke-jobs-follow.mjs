/**
 * Smoke — Jobs Follow (read-only acompanhamento).
 * C1: nav + cards + stage explicit/derived
 * C2: property/vendor filters + date default all
 * C3: read-only, Jobs unchanged, nav gates
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3101';
const __dir = dirname(fileURLToPath(import.meta.url));
const users = JSON.parse(readFileSync(join(__dir, '.smoke-vendor-free-users.json'), 'utf8'));

function sessionCookieValue(userId, role) {
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  return Buffer.from(JSON.stringify({ userId, role, exp })).toString('base64');
}

async function runAsUser(user, fn) {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
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
  const errors = [];
  page.on('pageerror', (e) => errors.push(`${user.email}: ${e.message}`));
  page.setDefaultTimeout(120000);
  let patchCount = 0;
  await page.route('**/api/pm/expenses/**', async (route) => {
    if (route.request().method() === 'PATCH') patchCount += 1;
    await route.continue();
  });
  try {
    await page.goto(`${BASE}/GodManager_Premium.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => typeof nav === 'function', { timeout: 60000 });
    return { ...(await fn(page)), errors, patchCount };
  } finally {
    await browser.close();
  }
}

async function followReady(page) {
  await page.evaluate(async () => {
    if (typeof gmJobsSetDateFilter === 'function') gmJobsSetDateFilter('all');
    if (typeof gmJobsSetPropertyFilter === 'function') gmJobsSetPropertyFilter('');
    if (typeof gmJobsSetVendorFilter === 'function') gmJobsSetVendorFilter('');
    nav('jobs-follow');
  });
  await page.waitForTimeout(2500);
  await page.evaluate(async () => {
    window.__jobsExpensesCacheAt = 0;
    if (typeof jobsInvalidateApiCache === 'function') jobsInvalidateApiCache();
    try {
      if (typeof jobsFetchFromApi === 'function') await jobsFetchFromApi();
    } catch (_e) {
      /* API local 500 — smoke usa mock */
    }
    if (typeof gmJobsFollowInit === 'function') await gmJobsFollowInit();
  });
  await page.waitForTimeout(2000);
}

function injectMocks(page) {
  return page.evaluate(() => {
    const mocks = [
      {
        id: 'smoke-follow-vreq',
        vendorId: 'v-smoke-1',
        vendorName: 'ACME Plumbing Co',
        propertyCode: 'P0099',
        propAddress: '123 Smoke Test St, Orlando FL',
        status: 'SCHEDULED',
        ownerCharged: 150,
        serviceDate: '2024-01-15',
        metadata: { followUp: { stage: 'vendor_requested' }, houseLabel: '123 Smoke Test St' },
      },
      {
        id: 'smoke-follow-final',
        vendorId: 'v-smoke-2',
        vendorName: 'Beta HVAC LLC',
        propertyCode: 'P0100',
        propAddress: '456 Finalized Ave, Kissimmee FL',
        status: 'FINALIZED',
        ownerCharged: 220,
        serviceDate: '2025-06-01',
        metadata: { houseLabel: '456 Finalized Ave' },
      },
      {
        id: 'smoke-follow-vfree',
        propertyCode: 'P0101',
        propAddress: '789 Internal Close',
        status: 'FINALIZED',
        isVendorFree: true,
        ownerCharged: 80,
        serviceDate: '2023-03-10',
        metadata: {},
      },
    ];
    if (typeof ltExpMapApiToRow !== 'function') return { ok: false, reason: 'ltExpMapApiToRow missing' };
    window.__jobsApiRowsCache = mocks.map((e) => ltExpMapApiToRow(e));
    if (typeof gmJobsFollowPopulateFilters === 'function') {
      return gmJobsFollowPopulateFilters().then(() => {
        if (typeof gmJobsFollowRender === 'function') gmJobsFollowRender();
        return { ok: true, count: window.__jobsApiRowsCache.length };
      });
    }
    if (typeof gmJobsFollowRender === 'function') gmJobsFollowRender();
    return { ok: true, count: window.__jobsApiRowsCache.length };
  });
}

async function smokeAdmin() {
  return runAsUser(users.admin, async (page) => {
    await followReady(page);
    await injectMocks(page);
    await page.waitForTimeout(800);

    const c1 = await page.evaluate(() => {
      const pg = document.getElementById('page-jobs-follow');
      const active = pg && pg.classList.contains('active');
      const cards = [...document.querySelectorAll('#jobs-follow-cards .gm-jf-card')];
      const vreq = document.querySelector('[data-job-id="smoke-follow-vreq"]');
      const fin = document.querySelector('[data-job-id="smoke-follow-final"]');
      const vfree = document.querySelector('[data-job-id="smoke-follow-vfree"]');
      const vreqCurrent = vreq
        ? !!vreq.querySelector('.gm-jf-step.is-current[data-stage="vendor_requested"]')
        : false;
      const finStage =
        fin && typeof gmJobFollowUpDisplayStage === 'function'
          ? gmJobFollowUpDisplayStage(
              (window.__jobsApiRowsCache || []).find((r) => r.id === 'smoke-follow-final'),
            )
          : null;
      const finCurrent = fin
        ? !!fin.querySelector('.gm-jf-step.is-current[data-stage="vendor_done"]')
        : false;
      const vfreeStage =
        vfree && typeof gmJobFollowUpDisplayStage === 'function'
          ? gmJobFollowUpDisplayStage(
              (window.__jobsApiRowsCache || []).find((r) => r.id === 'smoke-follow-vfree'),
            )
          : null;
      return {
        pageActive: !!active,
        cardCount: cards.length,
        vreqCurrent,
        finStage,
        finCurrent,
        vfreeStage,
      };
    });

    const c2 = await page.evaluate(async () => {
      if (typeof gmJobsFollowSetDateFilter === 'function') gmJobsFollowSetDateFilter('all');
      const allDateCount = document.querySelectorAll('#jobs-follow-cards .gm-jf-card').length;
      const oldDateVisible = !!document.querySelector('[data-job-id="smoke-follow-vreq"]');
      if (typeof gmJobsSetPropertyFilter === 'function') gmJobsSetPropertyFilter('P0099');
      if (typeof gmJobsFollowRender === 'function') gmJobsFollowRender();
      const afterProp = [...document.querySelectorAll('#jobs-follow-cards .gm-jf-card')].map((c) =>
        c.getAttribute('data-job-id'),
      );
      if (typeof gmJobsSetPropertyFilter === 'function') gmJobsSetPropertyFilter('');
      if (typeof gmJobsSetVendorFilter === 'function') gmJobsSetVendorFilter('ACME Plumbing Co');
      if (typeof gmJobsFollowRender === 'function') gmJobsFollowRender();
      const afterVendor = [...document.querySelectorAll('#jobs-follow-cards .gm-jf-card')].map((c) =>
        c.getAttribute('data-job-id'),
      );
      if (typeof gmJobsSetVendorFilter === 'function') gmJobsSetVendorFilter('');
      if (typeof gmJobsFollowRender === 'function') gmJobsFollowRender();
      return {
        dateFilter: window.__jobsDateFilter,
        allDateCount,
        oldDateVisible,
        propFilterOk: afterProp.length === 1 && afterProp[0] === 'smoke-follow-vreq',
        vendorFilterOk: afterVendor.length === 1 && afterVendor[0] === 'smoke-follow-vreq',
      };
    });

    const c3 = await page.evaluate(() => {
      const navFollow = document.getElementById('nav-jobs-follow');
      const navVisible = navFollow && navFollow.style.display !== 'none' && navFollow.offsetParent !== null;
      const jobsTable = !!document.getElementById('jobs-table');
      const jobsNewBtn = !!document.getElementById('jobs-new-btn');
      const followPatchBtn = !!document.querySelector(
        '#page-jobs-follow [onclick*="gmJobFollowUpPatch"],#page-jobs-follow [onclick*="followUpPatch"]',
      );
      nav('jobs');
      const jobsSubtitle = (document.getElementById('jobs-page-subtitle') || {}).textContent || '';
      return {
        navFollowVisible: navVisible,
        jobsTable,
        jobsNewBtn,
        followPatchBtn,
        jobsSubtitleLen: jobsSubtitle.length,
      };
    });

    const ok =
      c1.pageActive &&
      c1.cardCount >= 3 &&
      c1.vreqCurrent &&
      c1.finStage === 'vendor_done' &&
      c1.finCurrent &&
      c1.vfreeStage === 'closed_internal' &&
      c2.dateFilter === 'all' &&
      c2.oldDateVisible &&
      c2.propFilterOk &&
      c2.vendorFilterOk &&
      c3.navFollowVisible &&
      c3.jobsTable &&
      c3.jobsNewBtn &&
      !c3.followPatchBtn;

    return { ok, role: 'admin', c1, c2, c3 };
  });
}

async function smokeMaintenance() {
  return runAsUser(users.maint, async (page) => {
    await page.waitForFunction(() => typeof jobsApplyRoleGateV2 === 'function', { timeout: 60000 });
    await page.waitForTimeout(4000);
    const gate = await page.evaluate(async () => {
      if (typeof gmAuthHydrateUserBadge === 'function') await gmAuthHydrateUserBadge();
      const role = String((window.__gmCurrentUser && window.__gmCurrentUser.role) || '').toLowerCase();
      if (typeof jobsApplyRoleGateV2 === 'function') await jobsApplyRoleGateV2();
      const el = document.getElementById('nav-jobs-follow');
      const hiddenAfterGate = !el || el.style.display === 'none' || el.offsetParent === null;
      if (typeof gmApplyJobsOnlySidebarMode === 'function') gmApplyJobsOnlySidebarMode();
      const hiddenAfterJobsOnly = !el || el.style.display === 'none' || el.offsetParent === null;
      const jobsOnly = document.getElementById('nav-jobs');
      const jobsVisible = jobsOnly && jobsOnly.style.display !== 'none' && jobsOnly.offsetParent !== null;
      return {
        role,
        navFollowHidden: hiddenAfterGate,
        jobsOnlyHidesFollow: hiddenAfterJobsOnly,
        navJobsVisible: !!jobsVisible,
      };
    });
    return {
      ok: gate.jobsOnlyHidesFollow && gate.navJobsVisible,
      role: 'maintenance',
      gate,
    };
  });
}

const adminRun = await smokeAdmin();
await new Promise((r) => setTimeout(r, 4000));
const maintRun = await smokeMaintenance();

const summary = {
  pass:
    adminRun.ok &&
    maintRun.ok &&
    adminRun.patchCount === 0 &&
    (adminRun.errors?.length || 0) === 0 &&
    (maintRun.errors?.length || 0) === 0,
  admin: adminRun,
  maintenance: maintRun,
};

console.log(JSON.stringify(summary, null, 2));
process.exit(summary.pass ? 0 : 1);
