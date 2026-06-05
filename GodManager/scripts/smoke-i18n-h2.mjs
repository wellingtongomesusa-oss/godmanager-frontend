/**
 * Smoke H.2 — shell sidebar/topbar/footer i18n + toggle sem reload.
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
  const browser = await chromium.launch({ headless: true });
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

function shellSnapshot(page) {
  return page.evaluate(() => {
    const secs = [...document.querySelectorAll('.sb-sec-lbl')].map((el) => (el.textContent || '').trim());
    const items = [...document.querySelectorAll('.sidebar .si, .sidebar .ss')]
      .map((el) => {
        const sp = el.querySelector('[data-i18n]');
        return (sp || el).textContent?.trim().split('\n')[0] || '';
      })
      .filter(Boolean)
      .slice(0, 12);
    return {
      sections: secs,
      itemsSample: items,
      pageTitle: document.getElementById('page-title')?.textContent?.trim(),
      footer: document.querySelector('.sb-copyright [data-i18n]')?.textContent?.trim(),
      exportPdf: document.querySelector('[data-i18n="export_pdf"]')?.textContent?.trim(),
      backup: document.querySelector('[data-i18n="tb_backup"]')?.textContent?.trim(),
      langBtn: document.getElementById('lang-current')?.textContent?.trim(),
      dataI18nShell: document.querySelectorAll(
        '.sidebar [data-i18n], .topbar [data-i18n], .sb-copyright [data-i18n]',
      ).length,
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

// C1 — Shell PT
try {
  const { browser, page } = await openPremium(users.admin, 'pt');
  const snap = await shellSnapshot(page);
  results.c1 = {
    ok:
      snap.sections.includes('INICIO') &&
      snap.sections.includes('PROPRIEDADES') &&
      snap.sections.includes('COMUNICACOES') &&
      /direitos reservados/i.test(snap.footer || '') &&
      snap.langBtn === 'PT' &&
      snap.dataI18nShell >= 70,
    snap,
  };
  await browser.close();
} catch (e) {
  results.c1 = { ok: false, error: String(e.message || e) };
}

// C2 — Toggle EN -> PT -> ES sem reload
try {
  const { browser, page } = await openPremium(users.admin, 'en');
  const debugLogs = [];
  page.on('console', (msg) => {
    if (msg.text().includes('gmAfterLangChange')) debugLogs.push(msg.text());
  });
  const url0 = page.url();
  let reloads = 0;
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) reloads += 1;
  });
  await page.evaluate(() => nav('longterm'));
  await page.waitForTimeout(1500);
  const hashBefore = await page.evaluate(() => window.location.hash);
  await page.evaluate(() => gmSetLang('pt'));
  await page.waitForTimeout(1200);
  const pt = await shellSnapshot(page);
  await page.evaluate(() => gmSetLang('es'));
  await page.waitForTimeout(1200);
  const es = await shellSnapshot(page);
  const hashAfter = await page.evaluate(() => window.location.hash);
  results.c2 = {
    ok:
      reloads <= 2 &&
      hashAfter.indexOf('longterm') >= 0 &&
      pt.sections.includes('INICIO') &&
      pt.langBtn === 'PT' &&
      /Painel|prazo/i.test(pt.pageTitle || '') &&
      es.sections.some((s) => /PROPIEDADES|INICIO/i.test(s)) &&
      es.langBtn === 'ES' &&
      /Panel|plazo/i.test(es.pageTitle || '') &&
      debugLogs.length >= 2,
    pt,
    es,
    reloads,
    url0,
    urlFinal: page.url(),
    debugLogs,
  };
  await browser.close();
} catch (e) {
  results.c2 = { ok: false, error: String(e.message || e) };
}

// C3 — Jair maintenance PT + Jobs
try {
  const { browser, page } = await openPremium(users.maint, 'pt');
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const snap = await shellSnapshot(page);
  const visibleJobs = await page.evaluate(() => {
    const el = document.getElementById('nav-jobs');
    return el ? window.getComputedStyle(el).display !== 'none' : false;
  });
  await page.evaluate(() => {
    if (typeof gmJobsSetDateFilter === 'function') gmJobsSetDateFilter('all');
    if (typeof gmJobsSetViewMode === 'function') gmJobsSetViewMode('table');
    nav('jobs');
  });
  await page.waitForTimeout(4000);
  await page.evaluate(async () => {
    if (typeof gmJobsPopulatePropertyFilter === 'function') await gmJobsPopulatePropertyFilter();
    if (typeof jobsFetchFromApi === 'function') await jobsFetchFromApi();
    if (typeof jobsRender === 'function') await jobsRender();
  });
  await page.waitForTimeout(2000);
  const jobs = await page.evaluate(() => ({
    rows: document.querySelectorAll('#jobs-tbody tr').length,
    chipUrgent: !!document.querySelector('#gmjs-status-chips [data-status="urgent"]'),
    chipVfree: !!document.querySelector('#gmjs-status-chips [data-status="vfree"]'),
    propFilter: !!document.getElementById('jobs-property-filter'),
  }));
  results.c3 = {
    ok:
      snap.sections.includes('INICIO') &&
      visibleJobs &&
      jobs.rows > 0 &&
      jobs.chipVfree &&
      jobs.propFilter &&
      errors.length === 0,
    snap,
    jobs,
    errors,
  };
  await browser.close();
} catch (e) {
  results.c3 = { ok: false, error: String(e.message || e) };
}

// C4 — Admin EN + Dashboard
try {
  const { browser, page } = await openPremium(users.admin, 'en');
  const snap = await shellSnapshot(page);
  await page.evaluate(() => nav('longterm'));
  await page.waitForTimeout(3000);
  const dash = await page.evaluate(() => ({
    active: !!document.querySelector('#page-longterm.active'),
    kpi: !!document.getElementById('ltp-kpi-total') || document.querySelectorAll('#page-longterm .card').length > 0,
    title: document.getElementById('page-title')?.textContent?.trim(),
  }));
  results.c4 = {
    ok:
      snap.sections.includes('HOME') &&
      snap.langBtn === 'EN' &&
      dash.active &&
      dash.kpi,
    snap,
    dash,
  };
  await browser.close();
} catch (e) {
  results.c4 = { ok: false, error: String(e.message || e) };
}

const pass = results.c1?.ok && results.c2?.ok && results.c3?.ok && results.c4?.ok;
console.log(JSON.stringify({ pass, results }, null, 2));
process.exit(pass ? 0 : 1);
