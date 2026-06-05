/**
 * Smoke H.1 — persistência locale login → Premium + toggle sem reload.
 * Requer: next dev :3101, DATABASE_URL (prod read para users).
 *
 * Modo UI (cenários 1,2,4 com login real): SMOKE_PASSWORD="..."
 * Sem SMOKE_PASSWORD: usa cookie gm_auth + simula persist do LoginForm.
 */
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3101';
const PASSWORD = process.env.SMOKE_PASSWORD || '';
const __dir = dirname(fileURLToPath(import.meta.url));

function sessionCookieValue(userId, role) {
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  return Buffer.from(JSON.stringify({ userId, role, exp })).toString('base64');
}

function parseNextLocale(cookieStr) {
  const m = String(cookieStr || '').match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

function normShort(v) {
  const s = String(v || '').toLowerCase().replace(/_/g, '-');
  if (s === 'pt' || s === 'pt-br' || s.startsWith('pt-')) return 'pt';
  if (s === 'es' || s === 'es-es' || s.startsWith('es-')) return 'es';
  return 'en';
}

async function loginViaUi(page, localePath, email) {
  if (!PASSWORD) throw new Error('SMOKE_PASSWORD não definido');
  await page.goto(`${BASE}/${localePath}/login`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('#login-email', { timeout: 30000 });
  await page.fill('#login-email', email);
  await page.fill('#login-password', PASSWORD);
  await Promise.all([
    page.waitForURL(/GodManager_Premium\.html/, { timeout: 120000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(() => typeof nav === 'function', { timeout: 60000 });
}

async function openPremiumWithLocale(user, canonicalLocale, appLocalePath) {
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
  page.setDefaultTimeout(120000);

  if (appLocalePath) {
    await page.goto(`${BASE}/${appLocalePath}/login`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((loc) => {
      const s = String(loc).toLowerCase().replace(/_/g, '-');
      const short = s === 'pt' || s === 'pt-br' || s.startsWith('pt-') ? 'pt' : s.startsWith('es') ? 'es' : 'en';
      const canonical = short === 'pt' ? 'pt-BR' : short === 'es' ? 'es-ES' : 'en-US';
      localStorage.setItem('gm_lang', short);
      document.cookie = `NEXT_LOCALE=${canonical}; path=/; max-age=31536000; SameSite=Lax`;
    }, appLocalePath === 'pt-br' ? 'pt-br' : appLocalePath);
  } else {
    await context.addCookies([
      {
        name: 'NEXT_LOCALE',
        value: canonicalLocale,
        domain: 'localhost',
        path: '/',
        sameSite: 'Lax',
      },
    ]);
  }

  await page.goto(`${BASE}/GodManager_Premium.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof nav === 'function', { timeout: 60000 });
  return { browser, context, page };
}

const prisma = new PrismaClient();
let users = {};
try {
  users = JSON.parse(readFileSync(join(__dir, '.smoke-vendor-free-users.json'), 'utf8'));
} catch {
  const admin = await prisma.user.findFirst({
    where: { email: { equals: process.env.SMOKE_EMAIL || 'info@managerprop.com', mode: 'insensitive' } },
    select: { id: true, role: true, email: true },
  });
  const maint = await prisma.user.findFirst({
    where: { email: { equals: process.env.SMOKE_MAINT_EMAIL || 'jair@jair.com', mode: 'insensitive' } },
    select: { id: true, role: true, email: true },
  });
  users = { admin, maint };
}
await prisma.$disconnect();

const useUiLogin = !!PASSWORD;
const results = { mode: useUiLogin ? 'ui-login' : 'cookie-simulate' };

async function readGmResTitle(page) {
  return page.evaluate(() => {
    if (typeof gmResT === 'function') return gmResT('results_dashboard_title');
    const t = document.querySelector('[data-i18n="results_dashboard_title"]');
    return (t?.textContent || '').trim();
  });
}

// ── Cenário 1: locale PT ──
try {
  const debugLogs = [];
  let browser;
  let page;
  if (useUiLogin) {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.text().includes('[gm-i18n]')) debugLogs.push(msg.text());
    });
    await loginViaUi(page, 'pt-br', users.admin?.email || 'info@managerprop.com');
  } else {
    ({ browser, page } = await openPremiumWithLocale(users.admin, 'pt-BR', 'pt-br'));
    page.on('console', (msg) => {
      if (msg.text().includes('[gm-i18n]')) debugLogs.push(msg.text());
    });
  }
  const s1 = await page.evaluate(() => ({
    cookie: document.cookie,
    gm_lang: localStorage.getItem('gm_lang'),
    htmlLang: document.documentElement.lang,
    langBtn: document.getElementById('lang-current')?.textContent?.trim(),
    getGmLang: typeof getGmLang === 'function' ? getGmLang() : null,
    getGmLangShort: typeof getGmLangShort === 'function' ? getGmLangShort() : null,
  }));
  await page.evaluate(() => {
    nav('results');
    if (typeof gmResRender === 'function') gmResRender();
  });
  await page.waitForTimeout(2500);
  const resultsPt = await readGmResTitle(page);
  await page.evaluate(() => nav('vendors'));
  await page.waitForTimeout(2000);
  const vendorsPt = await page.evaluate(() => (document.getElementById('gv-title')?.textContent || '').trim());
  const nextLoc = parseNextLocale(s1.cookie);
  results.s1 = {
    ok:
      normShort(s1.gm_lang) === 'pt' &&
      (nextLoc === 'pt-BR' || normShort(nextLoc) === 'pt') &&
      s1.getGmLang === 'pt-BR' &&
      s1.getGmLangShort === 'pt' &&
      (s1.htmlLang === 'pt-BR' || s1.htmlLang?.toLowerCase().startsWith('pt')) &&
      s1.langBtn === 'PT' &&
      /Performance Financeira|RESULTADOS/i.test(resultsPt) &&
      /FORNECEDORES/i.test(vendorsPt),
    state: s1,
    nextLocale: nextLoc,
    resultsTitle: resultsPt,
    vendorsTitle: vendorsPt,
    debugLogs,
  };
  await browser.close();
} catch (e) {
  results.s1 = { ok: false, error: String(e.message || e) };
}

// ── Cenário 2: locale EN ──
try {
  let browser;
  let page;
  if (useUiLogin) {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    page = await context.newPage();
    await loginViaUi(page, 'en', users.admin?.email || 'info@managerprop.com');
  } else {
    ({ browser, page } = await openPremiumWithLocale(users.admin, 'en-US', 'en'));
  }
  const s2 = await page.evaluate(() => ({
    cookie: document.cookie,
    gm_lang: localStorage.getItem('gm_lang'),
    htmlLang: document.documentElement.lang,
    langBtn: document.getElementById('lang-current')?.textContent?.trim(),
    getGmLang: typeof getGmLang === 'function' ? getGmLang() : null,
    getGmLangShort: typeof getGmLangShort === 'function' ? getGmLangShort() : null,
  }));
  const nextLoc = parseNextLocale(s2.cookie);
  results.s2 = {
    ok:
      normShort(s2.gm_lang) === 'en' &&
      (nextLoc === 'en-US' || normShort(nextLoc) === 'en') &&
      s2.getGmLang === 'en-US' &&
      s2.getGmLangShort === 'en' &&
      s2.langBtn === 'EN',
    state: s2,
    nextLocale: nextLoc,
  };
  await browser.close();
} catch (e) {
  results.s2 = { ok: false, error: String(e.message || e) };
}

// ── Cenário 3: toggle EN→PT sem reload ──
try {
  const { browser, page } = await openPremiumWithLocale(users.admin, 'en-US', null);
  const debugLogs = [];
  page.on('console', (msg) => {
    if (msg.text().includes('gmAfterLangChange') || msg.text().includes('[gm-i18n]')) {
      debugLogs.push(msg.text());
    }
  });
  await page.evaluate(() => {
    localStorage.setItem('gm_lang', 'en');
    if (typeof setLanguage === 'function') setLanguage('en');
  });
  await page.evaluate(() => {
    nav('results');
    if (typeof gmResRender === 'function') gmResRender();
  });
  await page.waitForTimeout(2000);
  const beforeTitle = await readGmResTitle(page);
  const urlBefore = page.url();
  let reloadCount = 0;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) reloadCount += 1;
  });
  await page.evaluate(() => gmSetLang('pt'));
  await page.waitForTimeout(2000);
  const s3 = await page.evaluate(() => ({
    cookie: document.cookie,
    gm_lang: localStorage.getItem('gm_lang'),
    htmlLang: document.documentElement.lang,
    langBtn: document.getElementById('lang-current')?.textContent?.trim(),
    resultsTitle: typeof gmResT === 'function' ? gmResT('results_dashboard_title') : '',
    viewReportLabel: typeof gmResT === 'function' ? gmResT('view_report') : '',
  }));
  const nextLoc = parseNextLocale(s3.cookie);
  const noFullReload = page.url() === urlBefore && reloadCount <= 1;
  results.s3 = {
    ok:
      noFullReload &&
      normShort(s3.gm_lang) === 'pt' &&
      (nextLoc === 'pt-BR' || normShort(nextLoc) === 'pt') &&
      s3.langBtn === 'PT' &&
      /Performance Financeira|RESULTADOS/i.test(s3.resultsTitle) &&
      s3.viewReportLabel === 'Ver' &&
      debugLogs.some((l) => l.includes('gmAfterLangChange')),
    beforeTitle,
    afterTitle: s3.resultsTitle,
    reloadCount,
    noFullReload,
    debugLogs,
    state: s3,
  };
  await browser.close();
} catch (e) {
  results.s3 = { ok: false, error: String(e.message || e) };
}

// ── Cenário 4: Jair — Jobs intacto ──
try {
  let browser;
  let page;
  const errors = [];
  if (useUiLogin) {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await loginViaUi(page, 'pt-br', users.maint?.email || 'jair@jair.com');
  } else {
    ({ browser, page } = await openPremiumWithLocale(users.maint, 'pt-BR', 'pt-br'));
    page.on('pageerror', (e) => errors.push(e.message));
  }
  await page.evaluate(() => {
    if (typeof gmJobsSetDateFilter === 'function') gmJobsSetDateFilter('all');
    if (typeof gmJobsSetViewMode === 'function') gmJobsSetViewMode('table');
    nav('jobs');
  });
  await page.waitForTimeout(5000);
  await page.evaluate(async () => {
    if (typeof jobsFetchFromApi === 'function') await jobsFetchFromApi();
    if (typeof jobsRender === 'function') await jobsRender();
  });
  await page.waitForTimeout(2500);
  const s4 = await page.evaluate(() => {
    const rows = document.querySelectorAll('#jobs-tbody tr').length;
    const hasVFree = (document.getElementById('jobs-tbody')?.textContent || '').includes('V Free');
    const chipVfree = document.querySelector('#gmjs-status-chips [data-status="vfree"]');
    return { rows, hasVFree, chipVfree: !!chipVfree, gm_lang: localStorage.getItem('gm_lang') };
  });
  results.s4 = {
    ok: s4.rows > 0 && errors.length === 0 && normShort(s4.gm_lang) === 'pt',
    jobs: s4,
    errors,
  };
  await browser.close();
} catch (e) {
  results.s4 = { ok: false, error: String(e.message || e) };
}

const pass = results.s1?.ok && results.s2?.ok && results.s3?.ok && results.s4?.ok;
console.log(JSON.stringify({ pass, results }, null, 2));
process.exit(pass ? 0 : 1);
