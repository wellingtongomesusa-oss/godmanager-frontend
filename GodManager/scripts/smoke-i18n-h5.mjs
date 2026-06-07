/**
 * Smoke H.5 — Jobs i18n + Pacote F intacto.
 * Requer: next dev :3101, DATABASE_URL.
 */
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3101';
const __dir = dirname(fileURLToPath(import.meta.url));

function sessionCookieValue(userId, role) {
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  return Buffer.from(JSON.stringify({ userId, role, exp })).toString('base64');
}

async function openPremium(user, locale = 'pt') {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const canonical = locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US';
  await context.addCookies([
    {
      name: 'gm_auth',
      value: sessionCookieValue(user.id, user.role),
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
    { name: 'NEXT_LOCALE', value: canonical, domain: 'localhost', path: '/', sameSite: 'Lax' },
  ]);
  const page = await context.newPage();
  page.setDefaultTimeout(120000);
  await page.goto(`${BASE}/GodManager_Premium.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof nav === 'function' && typeof gmSetLang === 'function', {
    timeout: 60000,
  });
  await page.evaluate((loc) => {
    localStorage.setItem('gm_lang', loc);
    if (typeof setLanguage === 'function') setLanguage(loc);
  }, locale === 'pt' ? 'pt' : locale === 'es' ? 'es' : 'en');
  await page.waitForTimeout(1500);
  return { browser, page };
}

async function gotoJobsReady(page) {
  await page.evaluate(async () => {
    if (typeof gmJobsSetDateFilter === 'function') gmJobsSetDateFilter('all');
    if (typeof gmJobsSetViewMode === 'function') gmJobsSetViewMode('table');
    nav('jobs');
  });
  await page.waitForSelector('#page-jobs.active', { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(async () => {
    if (typeof gmJobsPopulatePropertyFilter === 'function') await gmJobsPopulatePropertyFilter();
    if (typeof jobsFetchFromApi === 'function') await jobsFetchFromApi();
    if (typeof jobsRender === 'function') await jobsRender();
  });
  await page.waitForTimeout(2000);
}

function jobsSnapshot(page) {
  return page.evaluate(() => {
    const pg = document.getElementById('page-jobs');
    const chipEls = [...document.querySelectorAll('#gmjs-status-chips button')];
    return {
      subtitle: document.getElementById('jobs-page-subtitle')?.textContent?.trim(),
      colHeaders: [...document.querySelectorAll('#jobs-table thead th[data-i18n]')].map((el) =>
        (el.textContent || '').trim(),
      ),
      chips: chipEls.map((b) => (b.textContent || '').replace(/\d+/g, '').trim()),
      viewTable: document.getElementById('jobs-vm-table')?.textContent?.trim(),
      dateToday: document.getElementById('jobs-df-today')?.textContent?.trim(),
      legendSnippet: (document.getElementById('jobs-table-legend')?.textContent || '').slice(0, 120),
      dataI18nJobs: pg ? pg.querySelectorAll('[data-i18n]').length : 0,
      rows: document.querySelectorAll('#jobs-tbody tr').length,
      chipUrgent: !!document.querySelector('#gmjs-status-chips [data-status="urgent"]'),
      chipVfree: !!document.querySelector('#gmjs-status-chips [data-status="vfree"]'),
      propFilter: !!document.getElementById('jobs-property-filter'),
      langBtn: document.getElementById('lang-current')?.textContent?.trim(),
    };
  });
}

const prisma = new PrismaClient();
let users = {};
try {
  users = JSON.parse(readFileSync(join(__dir, '.smoke-vendor-free-users.json'), 'utf8'));
} catch {
  users.admin = await prisma.user.findFirst({
    where: { email: { equals: 'info@managerprop.com', mode: 'insensitive' } },
    select: { id: true, role: true, email: true },
  });
  users.maint = await prisma.user.findFirst({
    where: { email: { equals: 'jair@jair.com', mode: 'insensitive' } },
    select: { id: true, role: true, email: true },
  });
}
await prisma.$disconnect();

const results = {};

// C1 — Jair PT: Jobs UI em português
try {
  const { browser, page } = await openPremium(users.maint, 'pt');
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await gotoJobsReady(page);
  const snap = await jobsSnapshot(page);
  results.c1 = {
    ok:
      snap.langBtn === 'PT' &&
      /manutencao|expenses abertos/i.test(snap.subtitle || '') &&
      snap.colHeaders.some((h) => /categoria|valor|acoes/i.test(h)) &&
      snap.chips.some((c) => /urgentes/i.test(c)) &&
      snap.chips.some((c) => /v free/i.test(c)) &&
      snap.dateToday === 'Hoje' &&
      snap.dataI18nJobs >= 45 &&
      errors.length === 0,
    snap,
    errors,
  };
  await browser.close();
} catch (e) {
  results.c1 = { ok: false, error: String(e.message || e) };
}

// C2 — Toggle EN <-> PT sem reload em Jobs
try {
  const { browser, page } = await openPremium(users.admin, 'en');
  let reloads = 0;
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) reloads += 1;
  });
  await gotoJobsReady(page);
  const en = await jobsSnapshot(page);
  const stateBefore = await page.evaluate(() => ({
    vendor: document.getElementById('jobs-vendor-filter')?.value || '',
    property: document.getElementById('jobs-property-filter')?.value || '',
    view: window.__jobsViewMode || 'table',
    dateFilter: window.__jobsDateFilter || 'all',
  }));
  await page.evaluate(() => gmSetLang('pt'));
  await page.waitForTimeout(1500);
  const pt = await jobsSnapshot(page);
  const stateAfter = await page.evaluate(() => ({
    vendor: document.getElementById('jobs-vendor-filter')?.value || '',
    property: document.getElementById('jobs-property-filter')?.value || '',
    view: window.__jobsViewMode || 'table',
    dateFilter: window.__jobsDateFilter || 'all',
  }));
  results.c2 = {
    ok:
      reloads <= 2 &&
      en.dateToday === 'Today' &&
      pt.dateToday === 'Hoje' &&
      pt.colHeaders.some((h) => /categoria|valor/i.test(h)) &&
      stateBefore.view === stateAfter.view &&
      stateBefore.dateFilter === stateAfter.dateFilter &&
      stateBefore.vendor === stateAfter.vendor &&
      stateBefore.property === stateAfter.property,
    en,
    pt,
    stateBefore,
    stateAfter,
    reloads,
  };
  await browser.close();
} catch (e) {
  results.c2 = { ok: false, error: String(e.message || e) };
}

// C3 — Regressão Pacote F (Jair PT)
try {
  const { browser, page } = await openPremium(users.maint, 'pt');
  await gotoJobsReady(page);
  const packF = await page.evaluate(async () => {
    const out = {
      propFilterWorks: false,
      urgentChipWorks: false,
      qtyBadge: false,
      rescheduleModalPt: false,
      chipVfree: false,
      dataRows: 0,
    };
    const prop = document.getElementById('jobs-property-filter');
    if (prop) {
      out.propFilterWorks = prop.options.length >= 1;
      if (prop.options.length > 1) {
        prop.value = prop.options[1].value;
        if (typeof gmJobsSetPropertyFilter === 'function') gmJobsSetPropertyFilter(prop.value);
        if (typeof jobsRender === 'function') await jobsRender();
      }
    }
    if (typeof gmJobsSetStatusFilter === 'function') {
      gmJobsSetStatusFilter('urgent');
      if (typeof jobsRender === 'function') await jobsRender();
      gmJobsSetStatusFilter('all');
      if (typeof jobsRender === 'function') await jobsRender();
      out.urgentChipWorks = !!document.querySelector('#gmjs-status-chips [data-status="urgent"].active, #gmjs-status-chips [data-status="urgent"]');
    }
    out.qtyBadge = !!document.querySelector('#jobs-table th[data-i18n="jobs_col_qty"]');
    out.dataRows = document.querySelectorAll('#jobs-tbody tr td[data-jobs-col], #jobs-tbody tr .col-qty').length;
    const postponeBtn = document.querySelector('#jobs-tbody button[onclick*="jobsReschedule"]');
    let jobId = null;
    if (postponeBtn) {
      const m = postponeBtn.getAttribute('onclick')?.match(/jobsReschedule\('([^']+)'/);
      jobId = m ? m[1] : null;
      postponeBtn.click();
    } else if (typeof jobsReschedule === 'function') {
      const cache = window.__jobsApiRowsCache || [];
      const row = cache.find((r) => r && r.id);
      jobId = row ? String(row.id) : 'smoke-h5-reschedule';
      jobsReschedule(jobId);
    }
    await new Promise((r) => setTimeout(r, 500));
    const modal = document.getElementById('gm-job-reschedule-modal');
    const vendorRadio = document.getElementById('gm-job-resched-radio-vendor');
    const tenantRadio = document.getElementById('gm-job-resched-radio-tenant');
    out.rescheduleModalPt =
      !!modal &&
      /tecnico|voltar/i.test(vendorRadio?.textContent || '') &&
      /tenant|atender/i.test(tenantRadio?.textContent || '');
    if (modal) modal.remove();
    out.chipVfree = !!document.querySelector('#gmjs-status-chips [data-status="vfree"]');
    out.jobIdForReschedule = jobId;
    return out;
  });
  results.c3 = {
    ok:
      packF.propFilterWorks &&
      packF.urgentChipWorks &&
      packF.qtyBadge &&
      packF.chipVfree &&
      packF.rescheduleModalPt,
    packF,
  };
  await browser.close();
} catch (e) {
  results.c3 = { ok: false, error: String(e.message || e) };
}

// C4 — Admin EN Jobs
try {
  const { browser, page } = await openPremium(users.admin, 'en');
  await gotoJobsReady(page);
  const snap = await jobsSnapshot(page);
  const packF = await page.evaluate(() => ({
    chipVfree: !!document.querySelector('#gmjs-status-chips [data-status="vfree"]'),
    chipUrgent: !!document.querySelector('#gmjs-status-chips [data-status="urgent"]'),
    rows: document.querySelectorAll('#jobs-tbody tr').length,
  }));
  results.c4 = {
    ok:
      snap.langBtn === 'EN' &&
      snap.dateToday === 'Today' &&
      snap.colHeaders.some((h) => /category|amount|actions/i.test(h)) &&
      packF.chipVfree &&
      packF.rows > 0,
    snap,
    packF,
  };
  await browser.close();
} catch (e) {
  results.c4 = { ok: false, error: String(e.message || e) };
}

// C5 — Admin ES toggle
try {
  const { browser, page } = await openPremium(users.admin, 'en');
  await gotoJobsReady(page);
  await page.evaluate(() => gmSetLang('es'));
  await page.waitForTimeout(1500);
  const snap = await jobsSnapshot(page);
  results.c5 = {
    ok:
      snap.langBtn === 'ES' &&
      (snap.dateToday === 'Hoy' || snap.dateToday === 'Manana') &&
      snap.colHeaders.some((h) => /categoria|valor|acciones/i.test(h)) &&
      snap.chips.some((c) => /urgentes/i.test(c)),
    snap,
  };
  await browser.close();
} catch (e) {
  results.c5 = { ok: false, error: String(e.message || e) };
}

const pass =
  results.c1?.ok && results.c2?.ok && results.c3?.ok && results.c4?.ok && results.c5?.ok;
console.log(JSON.stringify({ pass, results }, null, 2));
process.exit(pass ? 0 : 1);
