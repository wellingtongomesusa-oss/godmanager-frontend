/**
 * Smoke F7 — Jobs urgencia AR / encanamento (keywords).
 * Requires: next dev :3101, scripts/.smoke-vendor-free-users.json
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3101';
const __dir = dirname(fileURLToPath(import.meta.url));
const users = JSON.parse(readFileSync(join(__dir, '.smoke-vendor-free-users.json'), 'utf8'));

const URGENT_HINTS = ['leak', 'plumbing', 'hvac', 'a/c', 'encanamento', 'vazamento', 'air condition', 'ceiling leak'];
const NON_URGENT_HINTS = ['pool cleaning', 'pool clean', 'landscaping', 'lawn'];

function sessionCookieValue(userId, role) {
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  return Buffer.from(JSON.stringify({ userId, role, exp })).toString('base64');
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
    if (typeof gmJobsSetStatusFilter === 'function') gmJobsSetStatusFilter('all');
    nav('jobs');
  });
  await page.waitForTimeout(4000);
  await page.evaluate(async () => {
    window.__jobsExpensesCacheAt = 0;
    if (typeof jobsInvalidateApiCache === 'function') jobsInvalidateApiCache();
    if (typeof jobsFetchFromApi === 'function') await jobsFetchFromApi();
    if (typeof jobsRender === 'function') await jobsRender();
  });
  await page.waitForTimeout(2500);
}

async function smokeUser(user, tag) {
  return runAsUser(user, async (page) => {
    await jobsReady(page);

    const classified = await page.evaluate(({ urgentHints, nonHints }) => {
      const rows = (window.__jobsApiRowsCache || []).map((r) => {
        const text = [
          r.serviceType,
          r.desc,
          r.description,
          r.category,
          r._apiRaw?.description,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        const u = typeof gmJobIsUrgentByCategory === 'function' ? gmJobIsUrgentByCategory(r) : { isUrgent: false };
        return { id: r.id, text: text.slice(0, 80), urgent: u };
      });
      const urgentRows = rows.filter((x) => x.urgent.isUrgent);
      const nonUrgentSample = rows.find((x) => {
        if (x.urgent.isUrgent) return false;
        return nonHints.some((h) => x.text.includes(h));
      });
      const hintMatch = rows.filter((x) => urgentHints.some((h) => x.text.includes(h)));
      return { urgentCount: urgentRows.length, urgentRows: urgentRows.slice(0, 5), nonUrgentSample, hintMatch: hintMatch.length };
    }, { urgentHints: URGENT_HINTS, nonHints: NON_URGENT_HINTS });

    const urgentRowUi = await page.evaluate(() => {
      const trs = [...document.querySelectorAll('#jobs-tbody tr')];
      const hit = trs.find((tr) => tr.textContent.includes('URGENTE'));
      if (!hit) return { found: false };
      return {
        found: true,
        hasUrgentPill: (hit.textContent || '').includes('URGENTE'),
        hasQtyMark: !!hit.querySelector('.jobs-qty-urgent-mark'),
        statusHtml: hit.querySelector('[data-jobs-col="status"], [data-label="Status"]')?.innerHTML || '',
      };
    });

    await page.evaluate(() => {
      if (typeof gmJobsSetStatusFilter === 'function') gmJobsSetStatusFilter('urgent');
      if (typeof jobsRender === 'function') jobsRender();
    });
    await page.waitForTimeout(2000);

    const chipUrgent = await page.evaluate(() => {
      const chip = document.querySelector('#gmjs-status-chips [data-status="urgent"] .gmjs-chip-count');
      const rows = [...document.querySelectorAll('#jobs-tbody tr')];
      const allUrgent = rows.length > 0 && rows.every((tr) => (tr.textContent || '').includes('URGENTE'));
      return { count: chip ? parseInt(chip.textContent, 10) : 0, rowCount: rows.length, allUrgent };
    });

    await page.evaluate(() => {
      if (typeof gmJobsSetViewMode === 'function') gmJobsSetViewMode('calendar');
      if (typeof jobsRender === 'function') jobsRender();
    });
    await page.waitForTimeout(2000);

    const calRed = await page.evaluate(() => {
      const events = [...document.querySelectorAll('#jobs-calendar-host .jobs-cal-event')];
      const red = events.filter((el) => {
        const t = el.getAttribute('title') || '';
        const st = el.getAttribute('style') || '';
        return t.indexOf('Urgente:') >= 0 || st.indexOf('var(--red)') >= 0 || st.indexOf('#dc2626') >= 0;
      });
      return { total: events.length, urgentStyled: red.length };
    });

    const nonUrgentOk = await page.evaluate((sampleId) => {
      if (!sampleId) return true;
      const rows = window.__jobsApiRowsCache || [];
      const r = rows.find((x) => x.id === sampleId);
      if (!r) return true;
      return !gmJobsRowIsUrgent(r);
    }, classified.nonUrgentSample?.id || null);

    const ok =
      classified.urgentCount > 0 &&
      classified.hintMatch > 0 &&
      urgentRowUi.found &&
      urgentRowUi.hasUrgentPill &&
      urgentRowUi.hasQtyMark &&
      chipUrgent.count > 0 &&
      chipUrgent.allUrgent &&
      calRed.urgentStyled > 0 &&
      nonUrgentOk;

    return {
      ok,
      tag,
      classified,
      urgentRowUi,
      chipUrgent,
      calRed,
      nonUrgentOk,
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
    (adminRun.errors?.length || 0) === 0 &&
    (maintRun.errors?.length || 0) === 0,
  admin: adminRun,
  maintenance: maintRun,
};

console.log(JSON.stringify(summary, null, 2));
process.exit(summary.pass ? 0 : 1);
