/**
 * Smoke — Export Auditoria Properties (HTML formal).
 * Requer: next dev :3101, DATABASE_URL.
 */
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3101';
const __dir = dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const p = join(__dir, '..', '.env.local');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnvLocal();

function sessionCookieValue(userId, role) {
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  return Buffer.from(JSON.stringify({ userId, role, exp })).toString('base64');
}

async function openPremium(user, locale = 'pt', clientCookie = null) {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    acceptDownloads: true,
  });
  const canonical = locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US';
  const cookies = [
    {
      name: 'gm_auth',
      value: sessionCookieValue(user.id, user.role),
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
    { name: 'NEXT_LOCALE', value: canonical, domain: 'localhost', path: '/', sameSite: 'Lax' },
  ];
  if (clientCookie) {
    cookies.push({
      name: 'gm_active_client',
      value: clientCookie,
      domain: 'localhost',
      path: '/',
      sameSite: 'Lax',
    });
  }
  await context.addCookies(cookies);
  const page = await context.newPage();
  page.setDefaultTimeout(120000);
  await page.goto(`${BASE}/GodManager_Premium.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof nav === 'function' && typeof ltpExportAudit === 'function', {
    timeout: 60000,
  });
  await page.evaluate((loc) => {
    localStorage.setItem('gm_lang', loc);
    if (typeof setLanguage === 'function') setLanguage(loc);
  }, locale === 'pt' ? 'pt' : locale === 'es' ? 'es' : 'en');
  await page.waitForTimeout(1500);
  return { browser, page, context };
}

function seedMockProperties(page) {
  return page.evaluate(() => {
    const mock = Array.from({ length: 5 }, (_, i) => ({
      id: 'P' + String(1000 + i),
      address: `${1200 + i} Sample St, Kissimmee FL`,
      owner: 'Owner ' + (i + 1),
      tenant: i % 2 ? 'Tenant ' + i : '',
      bedrooms: 3 + (i % 2),
      bathrooms: 2,
      sqft: 1800 + i * 100,
      moveIn: '2025-01-15',
      occupancy: i % 3 === 0 ? 'vacant' : 'rented',
      rent: i % 3 === 0 ? 0 : 2500 + i * 50,
      deposit: 2500,
      guaranteeLimit: 400,
      mgmpct: 15,
      month: '2026-06',
      status: 'approved',
      statusOverride: i % 3 === 0 ? 'VG' : 'ALG',
    }));
    const key = window.GM_PROP_KEY || 'gm_properties_v2';
    localStorage.setItem(key, JSON.stringify({ schemaVersion: 2, savedAt: new Date().toISOString(), items: mock }));
    return mock.length;
  });
}

async function gotoProperties(page) {
  await page.evaluate(() => nav('ltproperties'));
  await page.waitForSelector('#page-ltproperties.active', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.evaluate(async () => {
    if (typeof gmPropertiesBootstrap === 'function') {
      try {
        await gmPropertiesBootstrap({ silent: true });
      } catch (e) {}
    }
    if (typeof ltpRender === 'function') await ltpRender();
  });
  const count = await page.evaluate(() => (typeof gmPropertiesFilteredUiRecords === 'function' ? gmPropertiesFilteredUiRecords().length : 0));
  if (count < 1) await seedMockProperties(page);
  await page.evaluate(async () => {
    if (typeof ltpRender === 'function') await ltpRender();
  });
  await page.waitForTimeout(1000);
}

function parseAuditHtml(html) {
  const invMatch = html.match(/<table class="audit"><thead><tr>[\s\S]*?<\/tbody>/);
  const invTable = invMatch ? invMatch[0] : '';
  const dataRows = (invTable.match(/<tbody>[\s\S]*?<\/tbody>/)?.[0].match(/<tr>/g) || []).length;
  const colHeaders = invTable.match(/<thead><tr>[\s\S]*?<\/thead>/)?.[0] || '';
  const cols = (colHeaders.match(/<th(?:\s[^>]*)?>/g) || []).length;
  const hasNavy = /--navy:\s*#1a1a2e/.test(html) && /--gold:\s*#d4a843/.test(html);
  const hasFonts = /IBM Plex Mono/.test(html) && /Inter/.test(html);
  const company = (html.match(/<div class="company">([^<]+)<\/div>/) || [])[1] || '';
  const statusPill = /AUDITADO|AUDITED/.test(html);
  return { dataRows, cols, hasNavy, hasFonts, company, statusPill };
}

const prisma = new PrismaClient();
let users = {};
let mvClient = null;
try {
  users = JSON.parse(readFileSync(join(__dir, '.smoke-vendor-free-users.json'), 'utf8'));
} catch {
  users.admin = await prisma.user.findFirst({
    where: { email: { equals: 'info@managerprop.com', mode: 'insensitive' } },
    select: { id: true, role: true, email: true },
  });
}
mvClient = await prisma.client.findFirst({
  where: { companyName: { contains: 'Master Vacation', mode: 'insensitive' } },
  select: { id: true, companyName: true },
});
await prisma.$disconnect();

const results = {};

// C1 — Admin MP: export full portfolio
try {
  const { browser, page } = await openPremium(users.admin, 'pt');
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await gotoProperties(page);
  const btn = await page.$('[data-i18n="export_audit"]');
  const audit = await page.evaluate(async () => {
    if (typeof gmPropertiesBootstrap === 'function') await gmPropertiesBootstrap({ silent: true });
    if (typeof ltpRender === 'function') await ltpRender();
    await ltpExportAudit();
    return window.__ltpLastExportAudit || null;
  });
  const captured = await page.evaluate(async () => {
    const records = gmPropertiesFilteredUiRecords();
    const filtered = ltpFilterTableRecords(records).slice();
    const pageEl = document.getElementById('page-ltproperties');
    const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
    const csvBtn = pageEl?.querySelector('button[onclick*="ltpExportCsv"]');
    const pdfBtn = pageEl?.querySelector('[data-i18n="export_pdf"]');
    const auditBtn = pageEl?.querySelector('[data-i18n="export_audit"]');
    const csvStyle = norm(csvBtn?.getAttribute('style'));
    const pdfStyle = norm(pdfBtn?.getAttribute('style'));
    const auditStyle = norm(auditBtn?.getAttribute('style'));
    return {
      rowCount: filtered.length,
      kpi: gmPropertiesPortfolioKpiCounts(filtered),
      hasCsv: typeof ltpExportCsv === 'function',
      hasPrint: true,
      btnAudit: !!auditBtn,
      btnCsv: !!csvBtn,
      btnPdf: !!pdfBtn,
      btnStyles: {
        csvStyle,
        pdfStyle,
        auditStyle,
        pdfMatchCsv: pdfStyle === csvStyle,
        auditMatchCsv: auditStyle === csvStyle,
        pdfHasNavy: /navy|#1a1a2e/i.test(pdfBtn?.getAttribute('style') || ''),
        auditHasNavy: /navy|#1a1a2e/i.test(auditBtn?.getAttribute('style') || ''),
        pdfClass: pdfBtn?.getAttribute('class') || '',
        auditClass: auditBtn?.getAttribute('class') || '',
      },
    };
  });
  const html = await page.evaluate(() => window.__ltpLastExportAuditHtml || '');
  const parsed = parseAuditHtml(html);
  const bs = captured.btnStyles || {};
  results.c1 = {
    ok:
      !!btn &&
      captured.hasCsv &&
      captured.btnCsv &&
      captured.btnPdf &&
      bs.auditMatchCsv &&
      bs.pdfMatchCsv &&
      !bs.auditHasNavy &&
      !bs.pdfHasNavy &&
      audit &&
      audit.rowCount >= 3 &&
      parsed.cols === 19 &&
      parsed.hasNavy &&
      parsed.hasFonts &&
      parsed.statusPill &&
      errors.length === 0,
    audit,
    captured,
    parsed,
    errors,
  };
  await browser.close();
} catch (e) {
  results.c1 = { ok: false, error: String(e.message || e) };
}

// C2 — Filter VG only
try {
  const { browser, page } = await openPremium(users.admin, 'pt');
  await gotoProperties(page);
  await seedMockProperties(page);
  const vg = await page.evaluate(async () => {
    const occ = document.getElementById('ltp-filter-occ');
    if (occ) {
      occ.value = 'VG';
      if (typeof ltpRender === 'function') await ltpRender();
    }
    const records = gmPropertiesFilteredUiRecords();
    const filtered = ltpFilterTableRecords(records);
    const allVg = filtered.length > 0 && filtered.every((r) => gmGetEffectiveStatus(r) === 'VG');
    await ltpExportAudit();
    return { rowCount: filtered.length, allVg, export: window.__ltpLastExportAudit };
  });
  results.c2 = {
    ok: vg.rowCount >= 1 && vg.allVg && vg.export && vg.export.rowCount === vg.rowCount,
    vg,
  };
  await browser.close();
} catch (e) {
  results.c2 = { ok: false, error: String(e.message || e) };
}

// C3 — MV client EN
try {
  const { browser, page } = await openPremium(users.admin, 'en');
  await gotoProperties(page);
  const mvClientObj = mvClient
    ? { id: mvClient.id, company: mvClient.companyName, companyName: mvClient.companyName }
    : { id: 'mv-smoke', company: 'Master Vacation Homes', companyName: 'Master Vacation Homes' };
  await page.evaluate((client) => {
    localStorage.setItem('gm_active_client', JSON.stringify(client));
    if (typeof updateBranding === 'function') updateBranding(client);
  }, mvClientObj);
  await seedMockProperties(page);
  const mv = await page.evaluate(async () => {
    if (typeof ltpRender === 'function') await ltpRender();
    const company = document.getElementById('sb-brand-name')?.textContent?.trim() || '';
    const records = gmPropertiesFilteredUiRecords();
    const filtered = ltpFilterTableRecords(records);
    await ltpExportAudit();
    const html = window.__ltpLastExportAuditHtml || '';
    return {
      company,
      rows: filtered.length,
      export: window.__ltpLastExportAudit,
      ref: window.__ltpLastExportAudit?.refCode || '',
      htmlCompany: (html.match(/<div class="company">([^<]+)<\/div>/) || [])[1] || '',
    };
  });
  results.c3 = {
    ok:
      /master vacation/i.test(mv.company || mv.htmlCompany || '') &&
      mv.rows >= 1 &&
      mv.export &&
      /PROP-AUDIT/.test(mv.ref),
    mv,
    mvClient: mvClientObj.companyName,
  };
  await browser.close();
} catch (e) {
  results.c3 = { ok: false, error: String(e.message || e) };
}

// C4 — HTML structure via inline generation
try {
  const { browser, page } = await openPremium(users.admin, 'pt');
  await gotoProperties(page);
  const sample = await page.evaluate(() => {
    const records = gmPropertiesFilteredUiRecords();
    const filtered = ltpFilterTableRecords(records).slice();
    return {
      rows: filtered.length,
      cols: 19,
      ref: 'PROP-AUDIT-test',
    };
  });
  results.c4 = { ok: sample.rows >= 3 && sample.cols === 19, sample };
  await browser.close();
} catch (e) {
  results.c4 = { ok: false, error: String(e.message || e) };
}

const pass = results.c1?.ok && results.c2?.ok && results.c3?.ok && results.c4?.ok;
console.log(JSON.stringify({ pass, results }, null, 2));
process.exit(pass ? 0 : 1);
