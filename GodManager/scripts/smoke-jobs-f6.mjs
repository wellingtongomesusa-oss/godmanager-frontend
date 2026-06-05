/**
 * Smoke F6 — Jobs QTY + TENANT columns, property filter, count-by-property.
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
    if (typeof gmJobsSetPropertyFilter === 'function') gmJobsSetPropertyFilter('');
    nav('jobs');
  });
  await page.waitForTimeout(4000);
  await page.evaluate(async () => {
    window.__jobsExpensesCacheAt = 0;
    window.__gmJobsF6BootDone = false;
    if (typeof jobsInvalidateApiCache === 'function') jobsInvalidateApiCache();
    if (typeof jobsFetchFromApi === 'function') await jobsFetchFromApi();
    if (typeof gmJobsBootF6 === 'function') await gmJobsBootF6();
    if (typeof jobsRender === 'function') await jobsRender();
  });
  await page.waitForTimeout(2500);
}

async function smokeUser(user, tag) {
  return runAsUser(user, async (page) => {
    await jobsReady(page);

    const api = await page.evaluate(async () => {
      const [expR, cntR] = await Promise.all([
        fetch('/api/pm/expenses', { credentials: 'include' }),
        fetch('/api/pm/expenses/count-by-property', { credentials: 'include' }),
      ]);
      const exp = await expR.json();
      const cnt = await cntR.json();
      return {
        expenseOk: expR.ok,
        countOk: cntR.ok,
        hasTenantField: (exp.expenses || []).some((e) => 'tenantName' in e),
        countsKeys: cnt.counts ? Object.keys(cnt.counts).length : 0,
      };
    });

    const headers = await page.evaluate(() => {
      const ths = [...document.querySelectorAll('#jobs-table thead th')].map((t) =>
        (t.textContent || '').trim(),
      );
      return ths;
    });

    const hasQty = headers.some((h) => /qty/i.test(h));
    const hasTenant = headers.some((h) => /tenant/i.test(h));

    const firstRow = await page.evaluate(() => {
      const tr = document.querySelector('#jobs-tbody tr');
      if (!tr) return null;
      return {
        hasQtyBadge: !!tr.querySelector('.jobs-qty-badge'),
        qtyText: tr.querySelector('.jobs-qty-badge')?.textContent?.trim() || '',
        tenantCell: tr.querySelector('.col-tenant')?.textContent?.trim() || '',
        hasPropertyFilter: !!document.getElementById('jobs-property-filter'),
      };
    });

    const propFilter = await page.evaluate(() => {
      const sel = document.getElementById('jobs-property-filter');
      if (!sel) return { ok: false, reason: 'no select' };
      const opts = [...sel.options].map((o) => ({
        value: o.value,
        label: (o.textContent || '').trim(),
        address: o.getAttribute('data-address') || '',
      }));
      const south = opts.find(
        (o) =>
          o.label.toLowerCase().includes('257') &&
          o.label.toLowerCase().includes('southfield'),
      );
      return { ok: true, optCount: opts.length, south: south || null, opts: opts.slice(0, 5) };
    });

    let filterOk = false;
    let calOk = false;
    let agendaOk = false;
    if (propFilter.south && propFilter.south.value) {
      await page.selectOption('#jobs-property-filter', propFilter.south.value);
      await page.waitForTimeout(2500);
      filterOk = await page.evaluate((addr) => {
        const rows = [...document.querySelectorAll('#jobs-tbody tr')];
        if (!rows.length) return false;
        return rows.every((tr) => {
          const unit = (tr.querySelector('.col-unit')?.textContent || '').toLowerCase();
          return unit.includes('257') && unit.includes('southfield');
        });
      }, propFilter.south.address);

      const qtyClick = await page.evaluate(() => {
        const btn = document.querySelector('#jobs-tbody .jobs-qty-badge');
        if (!btn) return { ok: false };
        const code = btn.getAttribute('onclick') || '';
        btn.click();
        return { ok: true, onclick: code };
      });
      await page.waitForTimeout(2000);
      const filterAfterQty = await page.evaluate(() => String(window.__jobsPropertyFilter || ''));
      const qtyClickOk = qtyClick.ok && !!filterAfterQty;

      await page.evaluate(() => {
        if (typeof gmJobsSetViewMode === 'function') gmJobsSetViewMode('calendar');
        if (typeof jobsRender === 'function') jobsRender();
      });
      await page.waitForTimeout(2000);
      calOk = await page.evaluate(() => {
        const host = document.getElementById('jobs-calendar-host');
        if (!host || host.style.display === 'none') return false;
        const total = (host.textContent || '').match(/Total mês:\s*(\d+)/);
        return total ? parseInt(total[1], 10) >= 0 : true;
      });

      await page.evaluate(() => {
        if (typeof gmJobsSetViewMode === 'function') gmJobsSetViewMode('agenda');
        if (typeof jobsRender === 'function') jobsRender();
      });
      await page.waitForTimeout(2000);
      agendaOk = await page.evaluate(() => {
        const host = document.getElementById('jobs-agenda-host');
        return !!(host && host.style.display !== 'none');
      });

      filterOk = filterOk && qtyClickOk;
    }

    const ok =
      api.expenseOk &&
      api.countOk &&
      api.hasTenantField &&
      api.countsKeys > 0 &&
      hasQty &&
      hasTenant &&
      firstRow?.hasQtyBadge &&
      firstRow?.hasPropertyFilter &&
      propFilter.optCount > 1 &&
      (propFilter.south ? filterOk && calOk && agendaOk : true);

    return {
      ok,
      tag,
      api,
      headers,
      firstRow,
      propFilter: { optCount: propFilter.optCount, south: propFilter.south?.label || null },
      filterOk,
      calOk,
      agendaOk,
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
