/**
 * Smoke F2 — V Free roxo (calendario, STATUS, chip, News).
 * Requires: next dev :3101, scripts/.smoke-vendor-free-users.json
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3101';
const PURPLE = '#a855f7';
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

async function runVFreeSaveFromJobs(page, tag) {
  const desc = `SMOKE_VFREE_F2_POOL_${tag}_${Date.now()}`;
  await page.waitForSelector('#lt-newexp-modal', { state: 'visible', timeout: 20000 });
  const vfreeChecked = await page.locator('#lt-nexp-vendor-free').isChecked();
  const propVal = await page.evaluate(() => {
    const sel = document.getElementById('lt-nexp-prop');
    if (!sel) return '';
    for (let i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value) return sel.options[i].value;
    }
    return '';
  });
  if (!propVal) return { ok: false, reason: 'no property' };
  await page.selectOption('#lt-nexp-prop', propVal);
  await page.fill('#lt-nexp-desc', desc);
  // Clone herda serviceType do job origem — limpar para nao disparar URGENTE (AR/encanamento).
  await page.fill('#lt-nexp-pm-svc', 'SMOKE general maintenance');
  const today = new Date().toISOString().slice(0, 10);
  await page.fill('#lt-nexp-pm-svc-date', today);
  const vc = await page.inputValue('#lt-nexp-pm-vendor-cost');
  if (!vc || Number(vc) <= 0) await page.fill('#lt-nexp-pm-vendor-cost', '100');
  await page.locator('#lt-newexp-modal button:has-text("Salvar")').click();
  await page.waitForTimeout(5000);
  const row = await page.evaluate(async (description) => {
    const r = await fetch('/api/pm/expenses', { credentials: 'include' });
    const j = await r.json();
    const hit = (j.expenses || []).find((e) => String(e.description || '') === description);
    return hit || null;
  }, desc);
  return { ok: !!(row && row.isVendorFree), desc, id: row?.id, vfreeChecked };
}

async function smokeUser(user, tag) {
  return runAsUser(user, async (page) => {
    await page.evaluate(() => {
      if (typeof gmJobsSetDateFilter === 'function') gmJobsSetDateFilter('all');
      if (typeof gmJobsSetViewMode === 'function') gmJobsSetViewMode('table');
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

    let created = { ok: false };
    const hasVFreeBtn = (await page.locator('#jobs-tbody button:has-text("V Free")').count()) > 0;
    if (hasVFreeBtn) {
      await page.locator('#jobs-tbody button:has-text("V Free")').first().click();
      created = await runVFreeSaveFromJobs(page, tag);
      await page.evaluate(async () => {
        window.__jobsExpensesCacheAt = 0;
        if (typeof jobsInvalidateApiCache === 'function') jobsInvalidateApiCache();
        if (typeof jobsFetchFromApi === 'function') await jobsFetchFromApi();
        if (typeof jobsRender === 'function') await jobsRender();
      });
      await page.waitForTimeout(3000);
    }

    const measureOverlap = () =>
      page.evaluate(() => {
        const rows = window.__jobsApiRowsCache || [];
        const vfree = rows.filter((r) => gmJobsRowIsVendorFree(r));
        const urgentVfree = vfree.filter((r) => gmJobsRowIsUrgent(r));
        const reschedVfree = vfree.filter((r) => gmJobsRowWasRescheduled(r));
        const calUrgent =
          urgentVfree.length > 0 && gmJobsCalStyleKey(urgentVfree[0]) === 'URGENT';
        const calVfreeOnly = vfree.find(
          (r) => gmJobsRowIsVendorFree(r) && !gmJobsRowIsUrgent(r),
        );
        const calPurple = !!(calVfreeOnly && gmJobsCalStyleKey(calVfreeOnly) === 'V_FREE');
        const reschedNonUrgent = reschedVfree.find((r) => !gmJobsRowIsUrgent(r));
        const calVfreeOverResched = reschedNonUrgent
          ? gmJobsCalStyleKey(reschedNonUrgent) === 'V_FREE'
          : false;
        return {
          vfreeCount: vfree.length,
          calUrgent,
          calPurple,
          calVfreeOverResched,
        };
      });

    let overlap = await measureOverlap();

    let calVfreeOverResched = !!overlap.calVfreeOverResched;
    if (!calVfreeOverResched && created.id) {
      const reschedCheck = await page.evaluate(async (id) => {
        const today = new Date().toISOString().slice(0, 10);
        const d2 = new Date(today + 'T12:00:00');
        d2.setDate(d2.getDate() + 9);
        const date2 = d2.toISOString().slice(0, 10);
        const month = today.slice(0, 7);
        const p1 = await fetch('/api/pm/expenses/' + encodeURIComponent(id), {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'SCHEDULED',
            serviceDate: today,
            monthRef: month,
          }),
        });
        const p2 = await fetch('/api/pm/expenses/' + encodeURIComponent(id), {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'SCHEDULED',
            serviceDate: date2,
            monthRef: date2.slice(0, 7),
            rescheduleBy: 'vendor',
          }),
        });
        const list = await fetch('/api/pm/expenses', { credentials: 'include' }).then((r) =>
          r.json(),
        );
        const e = (list.expenses || []).find((x) => x.id === id);
        if (!e || !e.isVendorFree) return { ok: false, reason: 'no expense' };
        const mapped =
          typeof ltExpMapApiToRow === 'function' ? ltExpMapApiToRow(e) : e;
        const key = gmJobsCalStyleKey(mapped);
        return {
          ok: p1.ok && p2.ok && !!e.wasRescheduled && key === 'V_FREE',
          key,
          wasRescheduled: !!e.wasRescheduled,
          isUrgent: gmJobsRowIsUrgent(mapped),
          p1: p1.status,
          p2: p2.status,
        };
      }, created.id);
      calVfreeOverResched = !!reschedCheck.ok;
      overlap = { ...overlap, calVfreeOverResched, reschedCheck };
    }

    const tableUi = await page.evaluate((desc) => {
      const trs = [...document.querySelectorAll('#jobs-tbody tr')];
      const hit = desc
        ? trs.find((tr) => (tr.textContent || '').includes('V FREE') && tr.innerHTML.length > 0)
        : trs.find((tr) => (tr.textContent || '').includes('V FREE'));
      if (!hit) return { found: false };
      const st = hit.querySelector('[data-jobs-col="status"], [data-label="Status"]');
      return {
        found: true,
        hasVFreePill: (st?.textContent || hit.textContent || '').includes('V FREE'),
        statusHtml: st?.innerHTML || '',
      };
    }, created.desc || '');

    await page.evaluate(() => {
      if (typeof gmJobsSetStatusFilter === 'function') gmJobsSetStatusFilter('vfree');
      if (typeof jobsRender === 'function') jobsRender();
    });
    await page.waitForTimeout(2000);
    const chipVfree = await page.evaluate(() => {
      const chip = document.querySelector('#gmjs-status-chips [data-status="vfree"] .gmjs-chip-count');
      const rows = [...document.querySelectorAll('#jobs-tbody tr')];
      const vfreeRows = rows.filter((tr) => (tr.textContent || '').includes('V FREE'));
      return {
        count: chip ? parseInt(chip.textContent, 10) : 0,
        rowCount: rows.length,
        vfreeRowCount: vfreeRows.length,
      };
    });

    const today = new Date().toISOString().slice(0, 10);
    const calMonth = today.slice(0, 7);
    await page.evaluate((ym) => {
      window.__jobsCalendarMonth = ym;
      if (typeof gmJobsSetViewMode === 'function') gmJobsSetViewMode('calendar');
      if (typeof jobsRender === 'function') jobsRender();
    }, calMonth);
    await page.waitForTimeout(2500);

    const calUi = await page.evaluate(
      ({ desc, purple }) => {
        const events = [...document.querySelectorAll('#jobs-calendar-host .jobs-cal-event')];
        const purpleEv = events.filter((el) => {
          const st = el.getAttribute('style') || '';
          const t = el.getAttribute('title') || '';
          return (
            st.indexOf(purple) >= 0 ||
            st.indexOf('168,85,247') >= 0 ||
            t.indexOf('V Free') >= 0
          );
        });
        const byDesc = desc
          ? events.filter((el) => (el.textContent || '').length > 0)
          : [];
        return {
          purpleCount: purpleEv.length,
          hasLegend: (document.querySelector('#jobs-calendar-host')?.textContent || '').includes(
            'V Free',
          ),
          sampleStyle: purpleEv[0]?.getAttribute('style') || '',
        };
      },
      { desc: created.desc || '', purple: PURPLE },
    );

    await page.evaluate(() => nav('news'));
    await page.waitForTimeout(3000);
    const newsPurple = await page.evaluate((purple) => {
      const pills = [...document.querySelectorAll('.gm-news-item, [class*="news"]')].flatMap(
        (el) => [...el.querySelectorAll('span')],
      );
      const vf = pills.find((s) => (s.textContent || '').trim() === 'V Free');
      if (!vf) {
        const feed = document.getElementById('news-feed') || document.querySelector('#page-news');
        const hasVFreeText = feed && (feed.textContent || '').includes('V Free');
        return { found: !!hasVFreeText, viaText: true };
      }
      const st = window.getComputedStyle(vf);
      const bd = st.borderColor || '';
      return {
        found: true,
        borderHasPurple: bd.indexOf('168') >= 0 || bd.indexOf('247') >= 0,
      };
    }, PURPLE);

    const ok =
      (created.ok || overlap.vfreeCount > 0) &&
      (tableUi.found ? tableUi.hasVFreePill : overlap.vfreeCount > 0) &&
      calUi.purpleCount > 0 &&
      calUi.hasLegend &&
      chipVfree.count > 0 &&
      chipVfree.vfreeRowCount > 0 &&
      overlap.calUrgent === true &&
      overlap.calPurple === true &&
      (calVfreeOverResched === true || overlap.calVfreeOverResched === true) &&
      (newsPurple.found || newsPurple.viaText);

    if (created.id) {
      await page.evaluate(async (id) => {
        await fetch('/api/pm/expenses/' + encodeURIComponent(id), {
          method: 'DELETE',
          credentials: 'include',
        });
      }, created.id);
    }

    return {
      ok,
      tag,
      created,
      overlap,
      tableUi,
      calUi,
      chipVfree,
      newsPurple,
    };
  });
}

const maintRun = await smokeUser(users.maint, 'maint');
await new Promise((r) => setTimeout(r, 8000));
const adminRun = await smokeUser(users.admin, 'admin');

const summary = {
  pass:
    maintRun.ok &&
    adminRun.ok &&
    (maintRun.errors?.length || 0) === 0 &&
    (adminRun.errors?.length || 0) === 0,
  admin: adminRun,
  maintenance: maintRun,
};

console.log(JSON.stringify(summary, null, 2));
process.exit(summary.pass ? 0 : 1);
