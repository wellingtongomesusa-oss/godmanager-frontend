/**
 * Smoke F3 — rescheduleBy tenant|vendor + badges V<n> T<n> via modal Adiar.
 * Requires: next dev :3101, scripts/.smoke-vendor-free-users.json
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

function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function runAsUser(user, fn) {
  const browser = await chromium.launch({ headless: true });
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
  try {
    await page.goto(`${BASE}/GodManager_Premium.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => typeof nav === 'function', { timeout: 60000 });
    return { ...(await fn(page)), errors };
  } finally {
    await browser.close();
  }
}

async function jobsReady(page) {
  await page.evaluate(async () => {
    if (typeof gmJobsSetDateFilter === 'function') gmJobsSetDateFilter('all');
    if (typeof gmJobsSetViewMode === 'function') gmJobsSetViewMode('table');
    nav('jobs');
  });
  await page.waitForTimeout(3500);
  await page.evaluate(async () => {
    window.__jobsExpensesCacheAt = 0;
    if (typeof jobsInvalidateApiCache === 'function') jobsInvalidateApiCache();
    if (typeof jobsFetchFromApi === 'function') await jobsFetchFromApi();
    if (typeof jobsRender === 'function') await jobsRender();
  });
  await page.waitForTimeout(2000);
}

async function findScheduledJob(page) {
  return page.evaluate(async () => {
    const r = await fetch('/api/pm/expenses', { credentials: 'include' });
    const j = await r.json();
    const list = (j.expenses || []).filter((e) => String(e.status) === 'SCHEDULED' && e.serviceDate);
    list.sort((a, b) => String(b.serviceDate).localeCompare(String(a.serviceDate)));
    return list[0] || null;
  });
}

async function rescheduleViaModal(page, jobId, newDate, by) {
  await page.evaluate((id) => {
    if (typeof jobsReschedule === 'function') jobsReschedule(id);
  }, jobId);
  await page.waitForSelector('#gm-job-reschedule-modal', { timeout: 15000 });
  const hasMotivo = await page.locator('input[name="gm-job-resched-by"]').count();
  if (hasMotivo < 2) return { ok: false, reason: 'modal missing motivo radios' };
  if (by === 'tenant') {
    await page.locator('input[name="gm-job-resched-by"][value="tenant"]').check();
  } else {
    await page.locator('input[name="gm-job-resched-by"][value="vendor"]').check();
  }
  await page.fill('#gm-job-resched-date', newDate);
  await page.click('#gm-job-resched-ok');
  await page.waitForTimeout(3500);
  await page.evaluate(async () => {
    window.__jobsExpensesCacheAt = 0;
    if (typeof jobsInvalidateApiCache === 'function') jobsInvalidateApiCache();
    if (typeof jobsFetchFromApi === 'function') await jobsFetchFromApi();
    if (typeof jobsRender === 'function') await jobsRender();
  });
  await page.waitForTimeout(2000);
  return { ok: true };
}

function countsFromMeta(metadata) {
  const list = metadata?.reschedules || [];
  if (!Array.isArray(list)) return { vendorCount: 1, tenantCount: 1, rescheduleEvents: 0 };
  return {
    vendorCount: list.filter((x) => x && x.by !== 'tenant').length + 1,
    tenantCount: list.filter((x) => x && x.by === 'tenant').length + 1,
    rescheduleEvents: list.length,
  };
}

function vtLabel(counts) {
  const parts = [];
  if (counts.vendorCount > 1) parts.push(`V${counts.vendorCount}`);
  if (counts.tenantCount > 1) parts.push(`T${counts.tenantCount}`);
  return parts.join(' ');
}

async function readStatusPillsForJob(page, jobId) {
  return page.evaluate((id) => {
    const trs = [...document.querySelectorAll('#jobs-tbody tr')];
    const hit = trs.find(
      (tr) =>
        tr.innerHTML.includes("jobsReschedule('" + id + "')") ||
        tr.innerHTML.includes('jobsReschedule("' + id + '")'),
    );
    if (!hit) return { found: false, text: '' };
    const pills = hit.querySelectorAll('.jobs-status-pills span');
    return { found: true, text: [...pills].map((s) => (s.textContent || '').trim()).join('|') };
  }, jobId);
}

async function fetchExpense(page, id) {
  return page.evaluate(async (expId) => {
    const r = await fetch('/api/pm/expenses', { credentials: 'include' });
    const j = await r.json();
    return (j.expenses || []).find((e) => e.id === expId) || null;
  }, id);
}

async function findLegacyRescheduledJob(page, excludeId) {
  return page.evaluate(async (skipId) => {
    const r = await fetch('/api/pm/expenses', { credentials: 'include' });
    const j = await r.json();
    const hit = (j.expenses || []).find((e) => {
      if (skipId && e.id === skipId) return false;
      if (!e.wasRescheduled) return false;
      const list = e.metadata?.reschedules;
      if (!Array.isArray(list) || !list.length) return false;
      return list.some((x) => x && x.by == null);
    });
    return hit || null;
  }, excludeId);
}

async function smokeUser(user, tag) {
  return runAsUser(user, async (page) => {
    await jobsReady(page);
    const job = await findScheduledJob(page);
    if (!job) return { ok: false, tag, reason: 'no SCHEDULED job' };

    const baseMeta = job.metadata || {};
    const baseLen = Array.isArray(baseMeta.reschedules) ? baseMeta.reschedules.length : 0;
    const b0 = countsFromMeta(baseMeta);

    const base = String(job.serviceDate).slice(0, 10);
    const d1 = addDays(base, 10);
    const d2 = addDays(d1, 7);
    const d3 = addDays(d2, 7);

    const expect1 = vtLabel({
      vendorCount: b0.vendorCount + 1,
      tenantCount: b0.tenantCount,
    });
    const expect2 = vtLabel({
      vendorCount: b0.vendorCount + 1,
      tenantCount: b0.tenantCount + 1,
    });
    const expect3 = vtLabel({
      vendorCount: b0.vendorCount + 2,
      tenantCount: b0.tenantCount + 1,
    });

    const m1 = await rescheduleViaModal(page, job.id, d1, 'vendor');
    if (!m1.ok) return { ok: false, tag, reason: 'modal1', m1 };
    const p1 = await readStatusPillsForJob(page, job.id);
    if (!expect1 || !p1.text.includes(expect1)) {
      return { ok: false, tag, reason: 'badge after vendor', expect: expect1, pills: p1 };
    }

    const m2 = await rescheduleViaModal(page, job.id, d2, 'tenant');
    if (!m2.ok) return { ok: false, tag, reason: 'modal2', m2 };
    const p2 = await readStatusPillsForJob(page, job.id);
    if (!expect2 || !p2.text.includes(expect2)) {
      return { ok: false, tag, reason: 'badge after tenant', expect: expect2, pills: p2 };
    }

    const m3 = await rescheduleViaModal(page, job.id, d3, 'vendor');
    if (!m3.ok) return { ok: false, tag, reason: 'modal3', m3 };
    const p3 = await readStatusPillsForJob(page, job.id);
    if (!expect3 || !p3.text.includes(expect3)) {
      return { ok: false, tag, reason: 'badge after 2nd vendor', expect: expect3, pills: p3 };
    }

    const exp = await fetchExpense(page, job.id);
    const list = exp?.metadata?.reschedules || [];
    const added = list.slice(baseLen);
    const byOk =
      added.length >= 3 &&
      added[added.length - 3].by === 'vendor' &&
      added[added.length - 2].by === 'tenant' &&
      added[added.length - 1].by === 'vendor';

    const legacy = await findLegacyRescheduledJob(page, job.id);
    let legacyOk = true;
    let legacyPills = null;
    if (legacy) {
      legacyPills = await page.evaluate((meta) => {
        const lbl =
          typeof gmJobRescheduleVtLabel === 'function'
            ? gmJobRescheduleVtLabel(gmJobRescheduleCounts(meta))
            : '';
        return lbl;
      }, legacy.metadata);
      legacyOk = /^V\d+$/.test(String(legacyPills || '').trim()) && !String(legacyPills).includes('T');
    }
    const legacyLogicOk = await page.evaluate(() => {
      if (typeof gmJobRescheduleCounts !== 'function' || typeof gmJobRescheduleVtLabel !== 'function')
        return false;
      const meta = {
        reschedules: [{ date: '2026-01-15', atIso: '2026-01-15T12:00:00.000Z' }],
      };
      const lbl = gmJobRescheduleVtLabel(gmJobRescheduleCounts(meta));
      return lbl === 'V2' && !lbl.includes('T');
    });

    const ok = byOk && legacyOk && legacyLogicOk;
    return {
      ok,
      tag,
      jobId: job.id,
      pills: { p1: p1.text, p2: p2.text, p3: p3.text },
      expect: { e1: expect1, e2: expect2, e3: expect3 },
      addedBy: added.map((x) => x.by),
      legacy: legacy ? { id: legacy.id, label: legacyPills } : null,
      legacyLogicOk,
    };
  });
}

const adminRun = await smokeUser(users.admin, 'admin');
await new Promise((r) => setTimeout(r, 8000));
const maintRun = await smokeUser(users.maint, 'maint');

const summary = {
  pass:
    adminRun.ok &&
    maintRun.ok &&
    adminRun.errors?.length === 0 &&
    maintRun.errors?.length === 0,
  admin: adminRun,
  maintenance: maintRun,
};

console.log(JSON.stringify(summary, null, 2));
process.exit(summary.pass ? 0 : 1);
