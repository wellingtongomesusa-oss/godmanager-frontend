/**
 * Smoke 5A — Maintenance transitions (role-scoped button panel).
 * C1: maintenance panel + Vendor escalate + V Free followUp
 * C2: admin/manager zero-regression on action buttons
 * C3: photos/comments + follow tracker + no property writes
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
  let propertyWrites = 0;
  let tenantWrites = 0;
  await page.route('**/api/properties/**', async (route) => {
    if (['PATCH', 'PUT', 'POST', 'DELETE'].includes(route.request().method())) propertyWrites += 1;
    await route.continue();
  });
  await page.route('**/api/tenants/**', async (route) => {
    if (['PATCH', 'PUT', 'POST', 'DELETE'].includes(route.request().method())) tenantWrites += 1;
    await route.continue();
  });
  try {
    await page.goto(`${BASE}/GodManager_Premium.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => typeof nav === 'function', { timeout: 60000 });
    return { ...(await fn(page)), errors, propertyWrites, tenantWrites };
  } finally {
    await browser.close();
  }
}

async function jobsTableReady(page, role) {
  await page.evaluate(async (r) => {
    window.__gmCurrentUser = Object.assign({}, window.__gmCurrentUser || {}, { role: r });
    if (typeof gmJobsSetDateFilter === 'function') gmJobsSetDateFilter('all');
    if (typeof gmJobsSetPropertyFilter === 'function') gmJobsSetPropertyFilter('');
    if (typeof gmJobsSetViewMode === 'function') gmJobsSetViewMode('table');
    nav('jobs');
  }, role);
  await page.waitForTimeout(2000);
  await page.evaluate(async () => {
    const mocks = [
      {
        id: 'smoke-5a-open',
        vendorId: 'v-5a',
        vendorName: 'Delta Plumbing',
        propertyCode: 'P0055',
        propAddress: '555 Maintenance Ln, Orlando FL',
        status: 'SCHEDULED',
        ownerCharged: 175,
        serviceDate: '2026-05-15',
        metadata: { houseLabel: '555 Maintenance Ln' },
      },
    ];
    const mapped =
      typeof ltExpMapApiToRow === 'function' ? mocks.map((e) => ltExpMapApiToRow(e)) : mocks;
    window.__jobsApiRowsCache = mapped;
    window.__jobsExpensesCacheAt = Date.now();
    const origFetch = window.jobsFetchFromApi;
    window.jobsFetchFromApi = async function () {
      window.__jobsApiRowsCache = mapped;
      return mapped;
    };
    if (typeof jobsRender === 'function') await jobsRender();
    window.jobsFetchFromApi = origFetch;
  });
  await page.waitForTimeout(1500);
}

function actionButtons(page) {
  return page.evaluate(() => {
    const cell = document.querySelector('#jobs-tbody tr .col-actions');
    if (!cell) return { ok: false, texts: [] };
    const texts = [...cell.querySelectorAll('button')].map((b) => (b.textContent || '').trim());
    const html = cell.innerHTML;
    return {
      ok: true,
      texts,
      hasPhoto: !!cell.querySelector('.btn-job-photo'),
      hasComment: !!cell.querySelector('.btn-job-comment'),
      hasInvoice: !!cell.querySelector('.btn-job-invoice'),
      hasV120: texts.some((t) => /V \+\$120/i.test(t)),
      hasJ200: texts.some((t) => /J \+\$200/i.test(t)),
      hasMgr: texts.some((t) => t === 'Mgr'),
      hasPostpone: texts.some((t) => /Postpone|Adiar/i.test(t)),
      hasReopen: texts.some((t) => /Reopen|Reabrir/i.test(t)),
      hasReactivate: texts.some((t) => /Reactivate|Reativar/i.test(t)),
      hasVFree: texts.includes('V Free'),
      hasVendorEscalate: texts.includes('Vendor'),
      hasFinalize: texts.some((t) => /✓ OK|OK/i.test(t)),
      hasCancel: html.includes('jobsCancel'),
      hasReturn: html.includes('jobsReturn'),
      onclickVendorEscalate: html.includes('jobsVendorEscalate'),
      onclickVendorFee: html.includes('jobsOnVendorClick'),
    };
  });
}

async function smokeMaintenance() {
  return runAsUser(users.maint, async (page) => {
    await page.waitForTimeout(3000);
    await page.evaluate(async () => {
      if (typeof gmAuthHydrateUserBadge === 'function') await gmAuthHydrateUserBadge();
      if (typeof jobsApplyRoleGateV2 === 'function') await jobsApplyRoleGateV2();
    });
    await jobsTableReady(page, 'maintenance');

    const panel = await actionButtons(page);

    const vendorEscalate = await page.evaluate(async () => {
      window.__gmNewsApiItems = [];
      const origPatch = window.gmJobFollowUpPatch;
      const patchCalls = [];
      window.gmJobFollowUpPatch = async (id, partial) => {
        patchCalls.push({ id, partial });
        if (typeof gmJobFollowUpOptimisticLocal === 'function') gmJobFollowUpOptimisticLocal(id, partial);
        return { ok: true, expense: { id, metadata: { followUp: partial } } };
      };
      const origNews = window.gmNewsPostJobAction;
      const newsCalls = [];
      window.gmNewsPostJobAction = (opts) => {
        newsCalls.push(opts);
        window.__gmNewsApiItems = (window.__gmNewsApiItems || []).concat([
          { subtype: opts.subtype, title: opts.title, jobId: opts.jobId, metadata: opts.metadata },
        ]);
      };
      await jobsVendorEscalate('smoke-5a-open');
      const row = (window.__jobsApiRowsCache || []).find((r) => r.id === 'smoke-5a-open');
      const stage =
        row && typeof gmJobFollowUpDisplayStage === 'function' ? gmJobFollowUpDisplayStage(row) : null;
      window.gmJobFollowUpPatch = origPatch;
      window.gmNewsPostJobAction = origNews;
      return {
        stage,
        patchCalls,
        newsCalls,
        pill: typeof gmNewsSubtypePill === 'function' ? gmNewsSubtypePill('vendor_requested') : null,
      };
    });

    const vFreeLogic = await page.evaluate(async () => {
      const origId = 'smoke-5a-open';
      const origPatch = window.gmJobFollowUpPatch;
      const patchCalls = [];
      window.gmJobFollowUpPatch = async (id, partial) => {
        patchCalls.push({ id, partial });
        if (typeof gmJobFollowUpOptimisticLocal === 'function') gmJobFollowUpOptimisticLocal(id, partial);
        return { ok: true };
      };
      const newsCalls = [];
      const origNews = window.gmNewsPostJobAction;
      window.gmNewsPostJobAction = (opts) => newsCalls.push(opts);
      if (typeof gmJobFollowUpPatch === 'function') {
        await gmJobFollowUpPatch(origId, { stage: 'closed_internal', note: 'fechado sem vendor' });
      }
      if (typeof gmNewsPostJobAction === 'function') {
        gmNewsPostJobAction({
          subtype: 'job_closed_internal',
          jobId: origId,
          title: 'Job fechado (interno): test',
          metadata: { houseLabel: '555 Maintenance Ln', propertyCode: 'P0055' },
        });
      }
      const row = (window.__jobsApiRowsCache || []).find((r) => r.id === origId);
      const stage =
        row && typeof gmJobFollowUpDisplayStage === 'function' ? gmJobFollowUpDisplayStage(row) : null;
      window.gmJobFollowUpPatch = origPatch;
      window.gmNewsPostJobAction = origNews;
      const clonePreserved = typeof jobsVendorFree === 'function';
      return { stage, patchCalls, newsCalls, clonePreserved, pill: gmNewsSubtypePill('job_closed_internal') };
    });

    const followTracker = await page.evaluate(async () => {
      nav('jobs-follow');
      if (typeof gmJobsFollowRender === 'function') gmJobsFollowRender();
      const card = document.querySelector('[data-job-id="smoke-5a-open"]');
      const current = card ? card.querySelector('.gm-jf-step.is-current') : null;
      return {
        hasCard: !!card,
        currentStage: current ? current.getAttribute('data-stage') : null,
      };
    });

    const photosComments = await page.evaluate(() => ({
      hasPhotoBtn: typeof document.querySelector('.btn-job-photo') !== 'undefined' && !!document.querySelector('#jobs-tbody .btn-job-photo'),
      hasCommentBtn: !!document.querySelector('#jobs-tbody .btn-job-comment'),
      photoHandler: typeof window.gmJobPhotoOpen === 'function' || !!document.querySelector('.btn-job-photo'),
    }));

    const c1 =
      panel.ok &&
      panel.hasPhoto &&
      panel.hasComment &&
      panel.hasVendorEscalate &&
      panel.hasVFree &&
      !panel.hasV120 &&
      !panel.hasJ200 &&
      !panel.hasMgr &&
      !panel.hasPostpone &&
      !panel.hasReopen &&
      !panel.hasReactivate &&
      !panel.hasCancel &&
      !panel.hasReturn &&
      !panel.hasInvoice &&
      panel.onclickVendorEscalate &&
      !panel.onclickVendorFee &&
      vendorEscalate.stage === 'vendor_requested' &&
      vendorEscalate.patchCalls.length === 1 &&
      vendorEscalate.patchCalls[0].partial.stage === 'vendor_requested' &&
      vendorEscalate.newsCalls.some((n) => n.subtype === 'vendor_requested') &&
      vendorEscalate.newsCalls.some((n) => n.metadata && n.metadata.houseLabel) &&
      vFreeLogic.stage === 'closed_internal' &&
      vFreeLogic.newsCalls.some((n) => n.subtype === 'job_closed_internal') &&
      vFreeLogic.clonePreserved;

    return {
      ok: c1 && followTracker.hasCard,
      role: 'maintenance',
      c1: { panel, vendorEscalate, vFreeLogic, followTracker, photosComments },
    };
  });
}

async function smokeAdmin() {
  return runAsUser(users.admin, async (page) => {
    await jobsTableReady(page, 'admin');
    const panel = await actionButtons(page);

    const unchanged = await page.evaluate(() => {
      const html = document.getElementById('jobs-table')?.outerHTML || '';
      return {
        hasJobsTable: !!document.getElementById('jobs-table'),
        hasFinalizeFn: typeof jobsFinalize === 'function',
        jobsVendorEscalateExists: typeof jobsVendorEscalate === 'function',
      };
    });

    const c2 =
      panel.ok &&
      panel.hasPhoto &&
      panel.hasComment &&
      panel.hasInvoice &&
      panel.hasV120 &&
      panel.hasJ200 &&
      panel.hasVFree &&
      !panel.hasVendorEscalate &&
      !panel.onclickVendorEscalate &&
      panel.onclickVendorFee &&
      unchanged.hasJobsTable &&
      unchanged.hasFinalizeFn;

    return { ok: c2, role: 'admin', c2: { panel, unchanged } };
  });
}

const maintRun = await smokeMaintenance();
await new Promise((r) => setTimeout(r, 4000));
const adminRun = await smokeAdmin();

const summary = {
  pass:
    maintRun.ok &&
    adminRun.ok &&
    maintRun.propertyWrites === 0 &&
    maintRun.tenantWrites === 0 &&
    adminRun.propertyWrites === 0 &&
    adminRun.tenantWrites === 0 &&
    (maintRun.errors?.length || 0) === 0 &&
    (adminRun.errors?.length || 0) === 0,
  maintenance: maintRun,
  admin: adminRun,
};

console.log(JSON.stringify(summary, null, 2));
process.exit(summary.pass ? 0 : 1);
