/**
 * Smoke — Jobs Follow (read-only acompanhamento + horizontal ring stepper).
 * C1: vendor_requested — current ring highlighted, done/future states
 * C2: closed_internal — internal path, current ring on closed_internal
 * C3: horizontal layout, read-only, other pages unchanged
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
        id: 'smoke-follow-internal',
        propertyCode: 'P0102',
        propAddress: '222 Internal Path Way',
        status: 'SCHEDULED',
        isVendorFree: true,
        ownerCharged: 90,
        serviceDate: '2025-01-10',
        metadata: { followUp: { stage: 'closed_internal' }, houseLabel: '222 Internal Path Way' },
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
    ];
    if (typeof ltExpMapApiToRow !== 'function') return { ok: false, reason: 'ltExpMapApiToRow missing' };
    const mapped = mocks.map((e) => ltExpMapApiToRow(e));
    window.__jobsApiRowsCache = mapped;
    window.__jobsExpensesCacheAt = Date.now();
    const origFetch = window.jobsFetchFromApi;
    window.jobsFetchFromApi = async function () {
      window.__jobsApiRowsCache = mapped;
      return mapped;
    };
    const done = () => {
      if (typeof gmJobsFollowRender === 'function') gmJobsFollowRender();
      window.jobsFetchFromApi = origFetch;
      return { ok: true, count: mapped.length };
    };
    if (typeof gmJobsFollowPopulateFilters === 'function') {
      return gmJobsFollowPopulateFilters().then(done);
    }
    return done();
  });
}

const STEPPER_SNAPSHOT_JS = `function(card){
 if(!card)return{ok:false};
 var stepper=card.querySelector('.gm-jf-stepper');
 var wrap=card.querySelector('.gm-jf-stepper-wrap');
 var caption=card.querySelector('.gm-jf-current-caption');
 var current=card.querySelector('.gm-jf-step.is-current');
 var doneCount=card.querySelectorAll('.gm-jf-step.is-done').length;
 var futureCount=card.querySelectorAll('.gm-jf-step.is-future').length;
 var visibleLabels=[].slice.call(card.querySelectorAll('.gm-jf-label')).filter(function(el){
  var cs=window.getComputedStyle(el);
  return cs.display!=='none'&&cs.visibility!=='hidden';
 });
 var stepperStyle=stepper?window.getComputedStyle(stepper):null;
 var currentRing=current?current.querySelector('.gm-jf-ring'):null;
 var currentRingStyle=currentRing?window.getComputedStyle(currentRing):null;
 return{
  ok:true,hasWrap:!!wrap,
  hasCaption:!!caption&&String(caption.textContent||'').trim().length>0,
  captionText:caption?String(caption.textContent||'').trim():'',
  flexDirection:stepperStyle?stepperStyle.flexDirection:null,
  flexWrap:stepperStyle?stepperStyle.flexWrap:null,
  ringCount:card.querySelectorAll('.gm-jf-ring').length,
  currentStage:current?current.getAttribute('data-stage'):null,
  currentRingW:currentRingStyle?parseFloat(currentRingStyle.width):0,
  doneCount:doneCount,futureCount:futureCount,visibleLabelCount:visibleLabels.length
 };
}`;

async function smokeAdmin() {
  return runAsUser(users.admin, async (page) => {
    await followReady(page);
    await injectMocks(page);
    await page.waitForTimeout(800);

    const c1 = await page.evaluate((snapSrc) => {
      const snap = new Function('return ' + snapSrc)();
      const pg = document.getElementById('page-jobs-follow');
      const vreq = document.querySelector('[data-job-id="smoke-follow-vreq"]');
      return {
        pageActive: !!(pg && pg.classList.contains('active')),
        cardCount: document.querySelectorAll('#jobs-follow-cards .gm-jf-card').length,
        snap: snap(vreq),
      };
    }, STEPPER_SNAPSHOT_JS);

    const c2 = await page.evaluate((snapSrc) => {
      const snap = new Function('return ' + snapSrc)();
      const internal = document.querySelector('[data-job-id="smoke-follow-internal"]');
      const row = (window.__jobsApiRowsCache || []).find((r) => r.id === 'smoke-follow-internal');
      const path =
        row && typeof gmJobsFollowStepperPath === 'function' ? gmJobsFollowStepperPath(row) : [];
      return {
        snap: snap(internal),
        path,
        stage:
          row && typeof gmJobFollowUpDisplayStage === 'function'
            ? gmJobFollowUpDisplayStage(row)
            : null,
      };
    }, STEPPER_SNAPSHOT_JS);

    const c2filters = await page.evaluate(async () => {
      if (typeof gmJobsFollowSetDateFilter === 'function') gmJobsFollowSetDateFilter('all');
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
        oldDateVisible,
        propFilterOk: afterProp.length === 1 && afterProp[0] === 'smoke-follow-vreq',
        vendorFilterOk: afterVendor.length === 1 && afterVendor[0] === 'smoke-follow-vreq',
      };
    });

    const c3 = await page.evaluate(() => {
      const followPatchBtn = !!document.querySelector(
        '#page-jobs-follow [onclick*="gmJobFollowUpPatch"],#page-jobs-follow [onclick*="followUpPatch"]',
      );
      const jobsTableBefore = !!document.getElementById('jobs-table');
      nav('jobs');
      const jobsTable = !!document.getElementById('jobs-table');
      const jobsSubtitleLen = (document.getElementById('jobs-page-subtitle') || {}).textContent.length;
      return { followPatchBtn, jobsTableBefore, jobsTable, jobsSubtitleLen };
    });

    const s1 = c1.snap;
    const s2 = c2.snap;
    const ok =
      c1.pageActive &&
      c1.cardCount >= 3 &&
      s1.ok &&
      s1.currentStage === 'vendor_requested' &&
      s1.flexDirection === 'row' &&
      s1.flexWrap === 'nowrap' &&
      s1.hasCaption &&
      s1.visibleLabelCount === 0 &&
      s1.doneCount >= 2 &&
      s1.futureCount >= 1 &&
      s1.currentRingW >= 24 &&
      s2.ok &&
      s2.currentStage === 'closed_internal' &&
      c2.path.includes('closed_internal') &&
      !c2.path.includes('vendor_requested') &&
      s2.flexDirection === 'row' &&
      s2.hasCaption &&
      c2filters.dateFilter === 'all' &&
      c2filters.propFilterOk &&
      c2filters.vendorFilterOk &&
      c3.jobsTable &&
      !c3.followPatchBtn;

    return { ok, role: 'admin', c1, c2, c2filters, c3 };
  });
}

async function smokeMaintenance() {
  return runAsUser(users.maint, async (page) => {
    await page.waitForFunction(() => typeof jobsApplyRoleGateV2 === 'function', { timeout: 60000 });
    await page.waitForTimeout(4000);
    const gate = await page.evaluate(async () => {
      if (typeof gmAuthHydrateUserBadge === 'function') await gmAuthHydrateUserBadge();
      if (typeof jobsApplyRoleGateV2 === 'function') await jobsApplyRoleGateV2();
      if (typeof gmApplyJobsOnlySidebarMode === 'function') gmApplyJobsOnlySidebarMode();
      const el = document.getElementById('nav-jobs-follow');
      const jobsOnly = document.getElementById('nav-jobs');
      return {
        navFollowHidden: !el || el.style.display === 'none' || el.offsetParent === null,
        navJobsVisible: !!(jobsOnly && jobsOnly.offsetParent !== null),
      };
    });
    return { ok: gate.navFollowHidden && gate.navJobsVisible, role: 'maintenance', gate };
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
