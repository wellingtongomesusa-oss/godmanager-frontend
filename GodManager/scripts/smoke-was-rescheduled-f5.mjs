/**
 * Smoke F5 — wasRescheduled + dual badges + calendar orange.
 * Requires: migrate deploy, next dev :3101, scripts/.smoke-vendor-free-users.json
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

async function rescheduleOnce(page, jobId, newDate, retries = 4) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const out = await page.evaluate(
      async ({ id, date }) => {
        const monthRef = date.slice(0, 7);
        const r = await fetch('/api/pm/expenses/' + encodeURIComponent(id), {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'SCHEDULED', serviceDate: date, monthRef }),
        });
        const t = await r.text();
        let j = {};
        try {
          j = t ? JSON.parse(t) : {};
        } catch (e) {}
        return { ok: r.ok, status: r.status, expense: j.expense || null };
      },
      { id: jobId, date: newDate },
    );
    if (out.ok) return out;
    if (out.status >= 500 && attempt < retries - 1) {
      await page.waitForTimeout(4000);
      continue;
    }
    return out;
  }
  return { ok: false, status: 0, expense: null };
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

function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function smokeUser(user, tag) {
  return runAsUser(user, async (page) => {
    await page.evaluate(() => {
      if (typeof gmJobsSetDateFilter === 'function') gmJobsSetDateFilter('all');
      if (typeof gmJobsSetViewMode === 'function') gmJobsSetViewMode('table');
      nav('jobs');
    });
    await page.waitForTimeout(3500);
    if (typeof page.waitForFunction === 'function') {
      await page.evaluate(async () => {
        if (typeof jobsFetchFromApi === 'function') await jobsFetchFromApi();
        if (typeof jobsRender === 'function') await jobsRender();
      });
      await page.waitForTimeout(2000);
    }

    const job = await findScheduledJob(page);
    if (!job) return { ok: false, reason: 'no SCHEDULED job' };

    const date1 = addDays(String(job.serviceDate).slice(0, 10), 14);
    const date2 = addDays(date1, 7);

    const p1 = await rescheduleOnce(page, job.id, date1);
    if (!p1.ok || !p1.expense?.wasRescheduled) {
      return { ok: false, reason: 'first reschedule failed', p1 };
    }
    const n1 = Array.isArray(p1.expense.metadata?.reschedules) ? p1.expense.metadata.reschedules.length : 0;

    await page.evaluate(async () => {
      window.__jobsExpensesCacheAt = 0;
      if (typeof jobsInvalidateApiCache === 'function') jobsInvalidateApiCache();
      if (typeof jobsFetchFromApi === 'function') await jobsFetchFromApi();
      if (typeof jobsRender === 'function') await jobsRender();
    });
    await page.waitForTimeout(2500);

    const dualPills = await page.evaluate((id) => {
      const row = document.querySelector('#jobs-tbody tr');
      const trs = [...document.querySelectorAll('#jobs-tbody tr')];
      const hit = trs.find((tr) => tr.innerHTML.includes(id) || tr.textContent.length > 0);
      if (!hit) return { found: false, html: '' };
      const pills = hit.querySelectorAll('.jobs-status-pills span');
      return {
        found: pills.length >= 2,
        pillCount: pills.length,
        hasScheduled: [...pills].some((s) => (s.textContent || '').includes('Agendado')),
        hasRescheduled: [...pills].some((s) => (s.textContent || '').includes('Reagendado')),
      };
    }, job.id);

    const calMonth = date1.slice(0, 7);
    await page.evaluate((ym) => {
      window.__jobsCalendarMonth = ym;
      if (typeof gmJobsSetViewMode === 'function') gmJobsSetViewMode('calendar');
      if (typeof jobsRender === 'function') jobsRender();
    }, calMonth);
    await page.waitForTimeout(2000);

    const calOrange = await page.evaluate(({ ym, date }) => {
      const events = [...document.querySelectorAll('#jobs-calendar-host .jobs-cal-event')];
      const withTip = events.filter((el) => (el.getAttribute('title') || '').indexOf('Reagendado') >= 0);
      const onDay = events.filter((el) => {
        const cell = el.closest('.jobs-cal-day[data-day-iso]');
        return cell && cell.getAttribute('data-day-iso') === date;
      });
      return {
        hasRescheduleTooltip: withTip.length > 0,
        month: ym,
        rescheduleEventCount: withTip.length,
        dayEventCount: onDay.length,
      };
    }, { ym: calMonth, date: date1 });

    const p2 = await rescheduleOnce(page, job.id, date2);
    const n2 = Array.isArray(p2.expense?.metadata?.reschedules) ? p2.expense.metadata.reschedules.length : 0;

    await page.evaluate(() => {
      window.__jobsStatusFilter = 'rescheduled';
      if (typeof jobsRender === 'function') jobsRender();
    });
    await page.waitForTimeout(1500);
    const chipCount = await page.evaluate(() => {
      const chip = document.querySelector('#gmjs-status-chips [data-status="rescheduled"] .gmjs-chip-count');
      return chip ? parseInt(chip.textContent, 10) : 0;
    });

    const ok =
      p1.ok &&
      p1.expense.wasRescheduled === true &&
      n1 >= 1 &&
      p2.ok &&
      n2 >= 2 &&
      (dualPills.found || dualPills.pillCount >= 2) &&
      calOrange.hasRescheduleTooltip &&
      chipCount > 0;

    return {
      ok,
      jobId: job.id,
      n1,
      n2,
      dualPills,
      calOrange,
      chipCount,
      tag,
    };
  });
}

const admin = users.admin;
const maint = users.maint;

const adminRun = await smokeUser(admin, 'admin');
await new Promise((r) => setTimeout(r, 8000));
const maintRun = await smokeUser(maint, 'maint');

const summary = {
  pass: adminRun.ok && maintRun.ok && adminRun.errors.length === 0 && maintRun.errors.length === 0,
  admin: adminRun,
  maintenance: maintRun,
};

console.log(JSON.stringify(summary, null, 2));
process.exit(summary.pass ? 0 : 1);
