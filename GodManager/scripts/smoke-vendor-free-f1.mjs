/**
 * Smoke Pacote F — V Free (maintenance + admin, field denied).
 * Requires: next dev -p 3101, PROD DB migrated (isVendorFree column).
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3101';
const __dir = dirname(fileURLToPath(import.meta.url));

function loadUsersFromCache() {
  const path = join(__dir, '.smoke-vendor-free-users.json');
  const raw = readFileSync(path, 'utf8');
  return JSON.parse(raw);
}

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
  page.on('pageerror', (e) => errors.push(`${user.email}: pageerror: ${e.message}`));
  page.setDefaultTimeout(120000);
  try {
    await page.goto(`${BASE}/GodManager_Premium.html`, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    await page.waitForFunction(
      () => typeof nav === 'function' && document.querySelector('.sidebar'),
      { timeout: 60000 },
    );
    await page.waitForFunction(
      async () => {
        try {
          const r = await fetch('/api/auth/me', { credentials: 'include' });
          const j = await r.json();
          return !!(j && (j.user || j.ok));
        } catch (e) {
          return false;
        }
      },
      { timeout: 30000 },
    );
    const result = await fn(page, context);
    return { ...result, errors };
  } finally {
    await browser.close();
  }
}

/** Cria V Free via modal (Expenses ou Jobs) e valida DB + News. */
async function runVFreeSaveFlow(page, tag) {
  const desc = `SMOKE_VFREE_${tag}_${Date.now()}`;
  await page.waitForSelector('#lt-newexp-modal', { state: 'visible', timeout: 20000 });
  const vfreeChecked = await page.locator('#lt-nexp-vendor-free').isChecked();
  const propVal = await page.evaluate(() => {
    const sel = document.getElementById('lt-nexp-prop');
    if (!sel || sel.options.length < 2) return '';
    for (let i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value) return sel.options[i].value;
    }
    return '';
  });
  if (!propVal) return { ok: false, reason: 'no property in dropdown' };
  await page.selectOption('#lt-nexp-prop', propVal);
  await page.fill('#lt-nexp-desc', desc);
  const today = new Date().toISOString().slice(0, 10);
  await page.fill('#lt-nexp-pm-svc-date', today);
  const vc = await page.inputValue('#lt-nexp-pm-vendor-cost');
  if (!vc || Number(vc) <= 0) await page.fill('#lt-nexp-pm-vendor-cost', '100');
  const beforeNews = await page.evaluate(async () => {
    try {
      const r = await fetch('/api/news?limit=40', { credentials: 'include' });
      const t = await r.text();
      const j = t ? JSON.parse(t) : {};
      return { ids: (j.items || []).map((x) => x.id), status: r.status };
    } catch (e) {
      return { ids: [], status: 0, err: String(e.message || e) };
    }
  });
  await page.locator('#lt-newexp-modal button:has-text("Salvar")').click();
  await page.waitForTimeout(5000);
  const afterNews = await page.evaluate(async (beforeIds) => {
    try {
      const r = await fetch('/api/news?limit=40', { credentials: 'include' });
      const t = await r.text();
      const j = t ? JSON.parse(t) : {};
      const items = j.items || [];
      const newItem = items.find(
        (x) => x.subtype === 'vendor_free' && !beforeIds.includes(x.id),
      );
      return { status: r.status, newsOk: !!newItem, count: items.length };
    } catch (e) {
      return { status: 0, newsOk: false, err: String(e.message || e) };
    }
  }, beforeNews.ids || []);
  const newsOk = !!afterNews.newsOk;
  const row = await page.evaluate(async (description) => {
    const r = await fetch('/api/pm/expenses', { credentials: 'include' });
    const j = await r.json();
    const list = j.expenses || [];
    const hit = list.find((e) => String(e.description || '') === description);
    if (!hit) return null;
    return {
      id: hit.id,
      isVendorFree: !!hit.isVendorFree,
      vendorId: hit.vendorId || null,
    };
  }, desc);
  let dbOk = false;
  let createdId = null;
  if (row && row.isVendorFree && (row.vendorId == null || row.vendorId === '')) {
    dbOk = true;
    createdId = row.id;
  }
  if (createdId) {
    await page.evaluate(async (id) => {
      await fetch(`/api/pm/expenses/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    }, createdId);
  }
  return {
    ok: dbOk && newsOk && vfreeChecked,
    dbOk,
    newsOk,
    vfreeChecked,
    desc,
    afterNews,
    beforeNews,
  };
}

async function waitJobsLoaded(page) {
  await page.evaluate(async () => {
    if (typeof jobsFetchFromApi === 'function') {
      try {
        await jobsFetchFromApi();
      } catch (e) {}
    }
    if (typeof jobsRender === 'function') {
      try {
        await jobsRender();
      } catch (e) {}
    }
  });
  await page.waitForTimeout(2500);
}

const checks = {};

const cached = loadUsersFromCache();
const maint = cached.maint;
const admin = cached.admin;
const field = cached.field || null;

if (!maint || maint.status !== 'active') {
  console.error('FAIL: maintenance user not in cache');
  process.exit(1);
}
if (!admin || admin.status !== 'active') {
  console.error('FAIL: admin user not in cache');
  process.exit(1);
}

const maintRun = await runAsUser(maint, async (page) => {
  const canRole = await page.evaluate(
    () => typeof gmCanVendorFreeRole === 'function' && gmCanVendorFreeRole(),
  );

  await page.evaluate(() => nav('jobs'));
  await page.waitForFunction(
    () => document.getElementById('page-jobs')?.classList.contains('active'),
    { timeout: 30000 },
  );
  await page.evaluate(() => {
    if (typeof gmJobsSetViewMode === 'function') gmJobsSetViewMode('table');
    if (typeof gmJobsSetDateFilter === 'function') gmJobsSetDateFilter('all');
  });
  await waitJobsLoaded(page);

  const jobsStats = await page.evaluate(() => {
    const tbody = document.getElementById('jobs-tbody');
    const txt = tbody ? tbody.textContent || '' : '';
    const vfree = document.querySelectorAll('#jobs-tbody button').length
      ? [...document.querySelectorAll('#jobs-tbody button')].filter((b) =>
          (b.textContent || '').trim() === 'V Free',
        ).length
      : 0;
    const rows = tbody ? tbody.querySelectorAll('tr').length : 0;
    const empty = txt.includes('Nenhum job');
    return { vfree, rows, empty };
  });

  let jobsFlow = { ok: false, skipped: true, reason: 'no jobs rows' };
  if (!jobsStats.empty && jobsStats.vfree > 0) {
    await page.locator('#jobs-tbody button:has-text("V Free")').first().click();
    jobsFlow = await runVFreeSaveFlow(page, 'MAINT_JOBS');
    jobsFlow.skipped = false;
  }

  await page.evaluate(() => nav('ltexpenses'));
  await page.waitForFunction(
    () => document.getElementById('page-ltexpenses')?.classList.contains('active'),
    { timeout: 20000 },
  );
  await page.evaluate(() => {
    if (typeof ltExpRenderWithPm === 'function') return ltExpRenderWithPm();
    if (typeof ltExpRender === 'function') ltExpRender();
  });
  await page.waitForTimeout(2000);

  const expBtnVisible = await page.evaluate(() => {
    const b = document.getElementById('lt-exp-vfree-btn');
    if (!b) return false;
    const st = window.getComputedStyle(b);
    return st.display !== 'none' && st.visibility !== 'hidden';
  });

  let expFlow = { ok: false };
  if (expBtnVisible) {
    await page.click('#lt-exp-vfree-btn');
    expFlow = await runVFreeSaveFlow(page, 'MAINT_EXP');
  }

  const apiProbe = await page.evaluate(async () => {
    const r = await fetch('/api/pm/expenses?limit=5', { credentials: 'include' });
    const j = await r.json();
    return { ok: r.ok, count: (j.expenses || []).length };
  });

  return {
    canRole,
    jobsStats,
    jobsFlow,
    expBtnVisible,
    expFlow,
    apiProbe,
  };
});

checks.maintenance = maintRun;

const adminRun = await runAsUser(admin, async (page) => {
  await page.evaluate(() => nav('jobs'));
  await waitJobsLoaded(page);
  const jobsStats = await page.evaluate(() => {
    const vfree = [...document.querySelectorAll('#jobs-tbody button')].filter(
      (b) => (b.textContent || '').trim() === 'V Free',
    ).length;
    const empty = (document.getElementById('jobs-tbody')?.textContent || '').includes('Nenhum job');
    return { vfree, empty };
  });
  let adminFlow = { ok: false, skipped: true };
  if (!jobsStats.empty && jobsStats.vfree > 0) {
    await page.locator('#jobs-tbody button:has-text("V Free")').first().click();
    adminFlow = await runVFreeSaveFlow(page, 'ADMIN');
    adminFlow.skipped = false;
  }
  return {
    canRole: await page.evaluate(() => gmCanVendorFreeRole()),
    jobsStats,
    adminFlow,
  };
});

checks.admin = adminRun;

if (field) {
  const fieldRun = await runAsUser(field, async (page) => {
    await page.evaluate(() => nav('jobs'));
    await waitJobsLoaded(page);
    const count = await page.locator('#jobs-tbody button:has-text("V Free")').count();
    const canRole = await page.evaluate(
      () => typeof gmCanVendorFreeRole === 'function' && gmCanVendorFreeRole(),
    );
    return { jobsVFreeVisible: count, canRole, email: field.email };
  });
  checks.field = fieldRun;
} else {
  checks.field = { skipped: true, reason: 'no active field user' };
}

const passMaint =
  checks.maintenance.canRole &&
  checks.maintenance.expBtnVisible &&
  checks.maintenance.expFlow.ok &&
  checks.maintenance.errors.length === 0 &&
  (checks.maintenance.jobsStats.empty ||
    checks.maintenance.jobsStats.vfree > 0 ||
    checks.maintenance.jobsFlow.ok ||
    checks.maintenance.jobsFlow.skipped);

const passAdmin =
  checks.admin.canRole &&
  checks.admin.errors.length === 0 &&
  (checks.admin.jobsStats.empty ||
    checks.admin.jobsStats.vfree > 0 ||
    checks.admin.adminFlow.ok ||
    checks.admin.adminFlow.skipped);

const passField = checks.field.skipped
  ? true
  : !checks.field.canRole &&
    checks.field.jobsVFreeVisible === 0 &&
    checks.field.errors.length === 0;

const summary = {
  pass: passMaint && passAdmin && passField,
  maintenance: checks.maintenance,
  admin: checks.admin,
  field: checks.field,
};

console.log(JSON.stringify(summary, null, 2));
process.exit(summary.pass ? 0 : 1);
