/**
 * Smoke 5B — Finalize with mandatory value (all roles).
 * C1: finalize with value → FINALIZED + jobValueOverride + followUp + News (maintenance + admin)
 * C2: finalize without value → confirm disabled; structural finalized_no_value backstop
 * C3: zero-regression — PATCH correct; value column; already FINALIZED unchanged; no property/tenant writes
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
  const patchBodies = [];
  await page.route('**/api/properties/**', async (route) => {
    if (['PATCH', 'PUT', 'POST', 'DELETE'].includes(route.request().method())) propertyWrites += 1;
    await route.continue();
  });
  await page.route('**/api/tenants/**', async (route) => {
    if (['PATCH', 'PUT', 'POST', 'DELETE'].includes(route.request().method())) tenantWrites += 1;
    await route.continue();
  });
  await page.route('**/api/pm/expenses/**', async (route) => {
    if (route.request().method() === 'PATCH') {
      let body = {};
      try {
        body = route.request().postDataJSON() || {};
      } catch (_e) {
        /* ignore */
      }
      patchBodies.push(body);
      const id = route.request().url().split('/').pop()?.split('?')[0] || '';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          expense: {
            id,
            status: body.status || 'SCHEDULED',
            jobValueOverride: body.jobValueOverride ?? null,
            metadata: { followUp: body.followUp || {} },
          },
        }),
      });
      return;
    }
    await route.continue();
  });
  try {
    await page.goto(`${BASE}/GodManager_Premium.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => typeof nav === 'function', { timeout: 60000 });
    return { ...(await fn(page, patchBodies)), errors, propertyWrites, tenantWrites };
  } finally {
    await browser.close();
  }
}

async function jobsTableReady(page, role, mocks) {
  await page.evaluate(async (r) => {
    window.__gmCurrentUser = Object.assign({}, window.__gmCurrentUser || {}, { role: r });
    if (typeof gmJobsSetDateFilter === 'function') gmJobsSetDateFilter('all');
    if (typeof gmJobsSetPropertyFilter === 'function') gmJobsSetPropertyFilter('');
    if (typeof gmJobsSetViewMode === 'function') gmJobsSetViewMode('table');
    nav('jobs');
  }, role);
  await page.waitForTimeout(2000);
  await page.evaluate(async (mockRows) => {
    const mapped =
      typeof ltExpMapApiToRow === 'function' ? mockRows.map((e) => ltExpMapApiToRow(e)) : mockRows;
    window.__jobsApiRowsCache = mapped;
    window.__jobsExpensesCacheAt = Date.now();
    const origFetch = window.jobsFetchFromApi;
    window.jobsFetchFromApi = async function () {
      window.__jobsApiRowsCache = mapped;
      return mapped;
    };
    if (typeof jobsRender === 'function') await jobsRender();
    window.jobsFetchFromApi = origFetch;
  }, mocks);
  await page.waitForTimeout(1500);
}

const vendorMock = {
  id: 'smoke-5b-vendor',
  vendorId: 'v-5b',
  vendorName: 'Gamma HVAC',
  propertyCode: 'P0055',
  propAddress: '555 Finalize Vendor Ln, Orlando FL',
  status: 'SCHEDULED',
  ownerCharged: 0,
  serviceDate: '2026-05-18',
  metadata: { followUp: { stage: 'vendor_requested' }, houseLabel: '555 Finalize Vendor Ln' },
};

const internalMock = {
  id: 'smoke-5b-internal',
  propertyCode: 'P0066',
  propAddress: '666 Internal Close Ave, Orlando FL',
  status: 'SCHEDULED',
  isVendorFree: true,
  ownerCharged: 0,
  serviceDate: '2026-05-19',
  metadata: { followUp: { stage: 'closed_internal' }, houseLabel: '666 Internal Close Ave' },
};

const finalizedMock = {
  id: 'smoke-5b-done',
  propertyCode: 'P0077',
  propAddress: '777 Already Done Blvd',
  status: 'FINALIZED',
  jobValueOverride: 185,
  ownerCharged: 185,
  serviceDate: '2026-04-01',
  metadata: { houseLabel: '777 Already Done Blvd' },
};

const finalizedNoValueMock = {
  id: 'smoke-5b-zero',
  propertyCode: 'P0088',
  propAddress: '888 Zero Value St',
  status: 'FINALIZED',
  ownerCharged: 0,
  serviceDate: '2026-03-01',
  metadata: { houseLabel: '888 Zero Value St' },
};

async function testFinalizeFlow(page, jobId, amount, patchBodies) {
  return page.evaluate(
    async ({ jobId, amount }) => {
      const newsCalls = [];
      const origNews = window.gmNewsPostJobAction;
      window.gmNewsPostJobAction = (opts) => newsCalls.push(opts);

      jobsFinalize(jobId);
      const modal = document.getElementById('jobs-finalize-modal');
      const btn = document.getElementById('jobs-finalize-confirm-btn');
      const inp = document.getElementById('jobs-finalize-amount');
      const modalOpen = modal && modal.style.display === 'flex';
      const confirmDisabledEmpty = !!(btn && btn.disabled);

      if (amount > 0) {
        if (amount === 120 || amount === 200) jobsFinalizeModalPick(amount);
        else if (inp) {
          inp.value = String(amount);
          jobsFinalizeModalSyncConfirm();
        }
      }

      const confirmEnabled = !!(btn && !btn.disabled);
      let finalizeResult = null;
      if (amount > 0 && confirmEnabled) {
        await jobsFinalizeConfirm();
        const row = (window.__jobsApiRowsCache || []).find((r) => r.id === jobId);
        finalizeResult = {
          status: row?.status,
          statusPm: row?.statusPm,
          jobValueOverride: row?.jobValueOverride,
          followStage:
            row && typeof gmJobFollowUpDisplayStage === 'function'
              ? gmJobFollowUpDisplayStage(row)
              : null,
          displayValue: row && typeof jobsRowDisplayValue === 'function' ? jobsRowDisplayValue(row) : null,
        };
      }

      window.gmNewsPostJobAction = origNews;
      return { modalOpen, confirmDisabledEmpty, confirmEnabled, finalizeResult, newsCalls };
    },
    { jobId, amount }
  );
}

async function smokeRole(user, roleLabel) {
  return runAsUser(user, async (page, patchBodies) => {
    await page.waitForTimeout(2000);
    await page.evaluate(async () => {
      if (typeof gmAuthHydrateUserBadge === 'function') await gmAuthHydrateUserBadge();
      if (typeof jobsApplyRoleGateV2 === 'function') await jobsApplyRoleGateV2();
    });

    const mocks = [vendorMock, internalMock, finalizedMock, finalizedNoValueMock];
    await jobsTableReady(page, user.role, mocks);

    const c2Blocked = await testFinalizeFlow(page, 'smoke-5b-vendor', 0, patchBodies);
    const patchesBefore = patchBodies.length;

    const c1Vendor = await testFinalizeFlow(page, 'smoke-5b-vendor', 120, patchBodies);
    const c1Internal = await testFinalizeFlow(page, 'smoke-5b-internal', 200, patchBodies);

    const c3Regression = await page.evaluate(() => {
      const done = (window.__jobsApiRowsCache || []).find((r) => r.id === 'smoke-5b-done');
      const beforeStatus = done?.status;
      const beforeVal = done?.jobValueOverride;
      jobsFinalize('smoke-5b-done');
      const modalAfter = document.getElementById('jobs-finalize-modal')?.style.display;
      const valCell = document.querySelector('[data-job-id="smoke-5b-vendor"] .jobs-val-display');
      return {
        doneUnchanged: beforeStatus === done?.status && beforeVal === done?.jobValueOverride,
        modalNotForced: modalAfter !== 'flex',
        hasValueCellFn: typeof jobsRowDisplayValue === 'function',
        hasFollowPage: typeof gmJobsFollowRender === 'function',
      };
    });

    const backstop = await page.evaluate(() => {
      window.__gmFinalizedNoValueAlerted = {};
      const newsCalls = [];
      window.gmNewsPostJobAction = (opts) => newsCalls.push(opts);
      const row = {
        id: 'struct-finalized-no-value',
        statusPm: 'FINALIZED',
        status: 'unpaid',
        ownerCharged: 0,
        _isPm: true,
        propAddress: '999 Backstop Test St',
        propertyCode: 'P0999',
        metadata: { houseLabel: '999 Backstop Test St' },
      };
      if (typeof gmJobsFinalizedNoValueBackstop === 'function') {
        gmJobsFinalizedNoValueBackstop([row]);
      }
      const pill =
        typeof gmNewsSubtypePill === 'function' ? gmNewsSubtypePill('finalized_no_value') : null;
      const i18n = window.GM_I18N
        ? {
            en: window.GM_I18N.en?.news_subtype_finalized_no_value,
            pt: window.GM_I18N.pt?.news_subtype_finalized_no_value,
            es: window.GM_I18N.es?.news_subtype_finalized_no_value,
          }
        : null;
      return { newsCalls, pill, i18n };
    });

    const lastPatches = patchBodies.slice(patchesBefore);
    const vendorPatch = lastPatches.find((p) => p.status === 'FINALIZED' && Number(p.jobValueOverride) === 120);
    const internalPatch = lastPatches.find((p) => p.status === 'FINALIZED' && Number(p.jobValueOverride) === 200);

    const c1 =
      c2Blocked.modalOpen &&
      c2Blocked.confirmDisabledEmpty &&
      !c2Blocked.finalizeResult &&
      c1Vendor.modalOpen &&
      c1Vendor.confirmEnabled &&
      c1Vendor.finalizeResult?.statusPm === 'FINALIZED' &&
      Number(c1Vendor.finalizeResult?.jobValueOverride) === 120 &&
      c1Vendor.finalizeResult?.followStage === 'vendor_done' &&
      Number(c1Vendor.finalizeResult?.displayValue) === 120 &&
      c1Vendor.newsCalls.some((n) => n.subtype === 'job_finalized' && n.metadata?.houseLabel) &&
      c1Internal.newsCalls.some((n) => n.subtype === 'job_finalized' && n.jobId === 'smoke-5b-internal') &&
      vendorPatch?.followUp?.stage === 'vendor_done' &&
      internalPatch?.followUp?.stage === 'closed_internal' &&
      Number(internalPatch?.jobValueOverride) === 200;

    const c2 =
      backstop.newsCalls.some(
        (n) => n.subtype === 'finalized_no_value' && n.jobId === 'struct-finalized-no-value'
      ) &&
      backstop.pill?.lbl &&
      backstop.i18n?.en &&
      backstop.i18n?.pt &&
      backstop.i18n?.es;

    const c3 =
      c3Regression.doneUnchanged &&
      c3Regression.hasValueCellFn &&
      c3Regression.hasFollowPage &&
      vendorPatch?.status === 'FINALIZED' &&
      internalPatch?.status === 'FINALIZED';

    return {
      ok: c1 && c2 && c3,
      role: roleLabel,
      c1: { c2Blocked, c1Vendor, c1Internal, vendorPatch, internalPatch },
      c2: backstop,
      c3: c3Regression,
      patchCount: patchBodies.length,
    };
  });
}

const maintRun = await smokeRole(users.maint, 'maintenance');
await new Promise((r) => setTimeout(r, 3000));
const adminRun = await smokeRole(users.admin, 'admin');

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
