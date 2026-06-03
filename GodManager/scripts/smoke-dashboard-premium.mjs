/**
 * Smoke Dashboard (#page-longterm) — requer dev :3101 + DATABASE_URL (prod read).
 */
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3101';
const EMAIL = (process.env.SMOKE_EMAIL || 'info@managerprop.com').toLowerCase();

function sessionCookieValue(userId, role) {
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  return Buffer.from(JSON.stringify({ userId, role, exp })).toString('base64');
}

const prisma = new PrismaClient();
const user = await prisma.user.findFirst({
  where: { email: { equals: EMAIL, mode: 'insensitive' } },
  select: { id: true, role: true, clientId: true, status: true },
});
if (!user || user.status !== 'active') {
  console.error('FAIL: user');
  process.exit(1);
}
await prisma.$disconnect();

const errors = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.addCookies([
  { name: 'gm_auth', value: sessionCookieValue(user.id, user.role), domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' },
]);
const page = await context.newPage();
page.setDefaultTimeout(180000);
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(`${BASE}/GodManager_Premium.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => document.querySelectorAll('#home-cards .card').length > 5, { timeout: 90000 }).catch(() => {});
await page.waitForFunction(
  () => {
    const n = typeof gmPropertiesLoad === 'function' ? (gmPropertiesLoad() || []).length : 0;
    return n >= 100;
  },
  { timeout: 120000 },
);
if (typeof page.evaluate === 'function') {
  await page.evaluate(async () => {
    if (typeof gmHomeEnsurePropertiesCache === 'function') await gmHomeEnsurePropertiesCache();
    if (typeof loadHomeDashboardFromApi === 'function') await loadHomeDashboardFromApi();
  });
}
await page.waitForTimeout(2000);

const homeBefore = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('#home-cards .card')];
  const pick = (re) => {
    const c = cards.find((x) => re.test(x.querySelector('.cl')?.textContent || ''));
    return (c?.querySelector('.cv2')?.textContent || '').trim();
  };
  return {
    total: pick(/TOTAL HOUSES/i),
    vacant: pick(/VACANT HOUSES/i),
    rented: pick(/RENTED HOUSES/i),
  };
});

await page.evaluate(() => { if (typeof nav === 'function') nav('ltproperties'); });
await page.waitForFunction(
  () => parseInt((document.getElementById('ltp-kpi-total')?.textContent || '0').replace(/\D/g, ''), 10) >= 100,
  { timeout: 120000 },
);
await page.waitForTimeout(2000);
const ltpBeforeDash = await page.evaluate(() => ({
  total: (document.getElementById('ltp-kpi-total')?.textContent || '').trim(),
  rented: (document.getElementById('ltp-kpi-rented')?.textContent || '').trim(),
  vacant: (document.getElementById('ltp-kpi-vacant')?.textContent || '').trim(),
}));

await page.evaluate(async () => {
  if (typeof nav === 'function') nav('longterm');
  const deadline = Date.now() + 170000;
  while (Date.now() < deadline) {
    const total = parseInt(String(document.getElementById('ltd-strip-total')?.textContent || '0').replace(/\D/g, ''), 10);
    const ctr = parseInt(String(document.getElementById('ltd-portfolio-donut-ctr')?.textContent || '0').replace(/\D/g, ''), 10);
    if (total >= 100 && ctr >= 100 && window.__ltdDashCharts?.bar) return;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('Dashboard charts/render timeout');
});
await page.waitForTimeout(800);

const dash = await page.evaluate(() => {
  const g = (id) => (document.getElementById(id)?.textContent || '').trim();
  const heroFs = parseFloat(getComputedStyle(document.getElementById('ltd-hero-vacant-count')).fontSize) || 0;
  const recFs = parseFloat(getComputedStyle(document.getElementById('ltd-receita-value')).fontSize) || 0;
  const donut = !!window.__ltdDashCharts?.donut;
  const bar = !!window.__ltdDashCharts?.bar;
  const donutData = window.__ltdDashCharts?.donut?.data?.datasets?.[0]?.data || [];
  const barLabels = window.__ltdDashCharts?.bar?.data?.labels?.length || 0;
  const donutCtr = (document.getElementById('ltd-portfolio-donut-ctr')?.textContent || '').trim();
  const rows = document.querySelectorAll('#ltd-hero-vacant-tbody tr').length;
  const firstVacant = [...document.querySelectorAll('#ltd-hero-vacant-tbody tr')].slice(0, 3).map((tr) => {
    const tds = tr.querySelectorAll('td');
    return { addr: (tds[0]?.textContent || '').trim(), days: (tds[2]?.textContent || '').trim() };
  });
  const dupes = {};
  [...document.querySelectorAll('#ltd-hero-vacant-tbody tr')].forEach((tr) => {
    const a = (tr.querySelectorAll('td')[0]?.textContent || '').trim();
    dupes[a] = (dupes[a] || 0) + 1;
  });
  const dupeAddrs = Object.keys(dupes).filter((k) => dupes[k] > 1);
  return {
    heroVacant: g('ltd-hero-vacant-count'),
    stripTotal: g('ltd-strip-total'),
    stripRented: g('ltd-strip-rented'),
    stripVacant: g('ltd-strip-vacant'),
    receita: g('ltd-receita-value'),
    ganho: g('ltd-ganho-value'),
    jobsTotal: g('ltd-jobs-total'),
    jobsRows: document.querySelectorAll('#ltd-jobs-tbody tr').length,
    vacantRows: rows,
    firstVacant,
    dupeAddrs,
    oldTableGone: !document.getElementById('ltd-all-wrap'),
    heroFontPx: heroFs,
    receitaFontPx: recFs,
    chartDonut: donut,
    chartBar: bar,
    donutSegments: donutData.length,
    donutCenter: donutCtr,
    barMonthCount: barLabels,
  };
});

await page.evaluate(() => { if (typeof nav === 'function') nav('ltproperties'); });
await page.waitForFunction(
  () => parseInt((document.getElementById('ltp-kpi-total')?.textContent || '0').replace(/\D/g, ''), 10) >= 100,
  { timeout: 90000 },
);
const ltpTotal = await page.evaluate(() => (document.getElementById('ltp-kpi-total')?.textContent || '').trim());

let editVacant = { ok: false };
try {
  await page.evaluate(() => { if (typeof nav === 'function') nav('longterm'); });
  await page.waitForTimeout(2000);
  const btn = page.locator('#ltd-hero-vacant-tbody button').first();
  if ((await btn.count()) > 0) {
    await btn.click();
    await page.waitForTimeout(2000);
    const modal = page.locator('#ltp-property-modal');
    const visible = await modal.isVisible().catch(() => false);
    const patchOnly = await page.evaluate(() => {
      const fn = window.ltpSaveNewProperty;
      return fn && (String(fn).includes("method='PATCH'") || String(fn).includes('method=\"PATCH\"'));
    });
    await page.keyboard.press('Escape');
    editVacant = { ok: visible, patchOnly };
  }
} catch (e) {
  editVacant = { error: String(e.message || e) };
}

await browser.close();

const heroN = parseInt(dash.heroVacant, 10);
const totalN = parseInt(dash.stripTotal, 10);
const rentedN = parseInt(dash.stripRented, 10);
const vacantN = parseInt(dash.stripVacant, 10);
const receitaN = parseFloat(String(dash.receita).replace(/[^0-9.-]/g, '')) || 0;
const ganhoN = parseFloat(String(dash.ganho).replace(/[^0-9.-]/g, '')) || 0;
const jobsN = parseInt(dash.jobsTotal, 10);

const expTotal = parseInt(String(ltpBeforeDash.total).replace(/\D/g, ''), 10);
const expRented = parseInt(String(ltpBeforeDash.rented).replace(/\D/g, ''), 10);
const expVacant = parseInt(String(ltpBeforeDash.vacant).replace(/\D/g, ''), 10);
const homeTotalN = parseInt(String(homeBefore.total).replace(/\D/g, ''), 10);
const homeVacantN = parseInt(String(homeBefore.vacant).replace(/\D/g, ''), 10);

const checks = {
  noPageErrors: errors.length === 0,
  heroMatchesLtpVacant: heroN === expVacant,
  stripMatchesLtpTotal: totalN === expTotal,
  stripMatchesLtpRented: rentedN === expRented,
  stripMatchesLtpVacant: vacantN === expVacant,
  rentedPlusVacant: rentedN + vacantN === totalN,
  heroRedVisible: heroN >= 1,
  receitaPositive: receitaN > 0,
  ganhoPositive: ganhoN > 0,
  jobsNotZero: jobsN > 0,
  jobsRowsShown: dash.jobsRows > 0,
  vacantListRows: dash.vacantRows === heroN,
  noDupeHappyEagle: !dash.dupeAddrs.some((a) => /16368/i.test(a)),
  oldTableRemoved: dash.oldTableGone,
  homeTotalMatches: homeTotalN === expTotal,
  homeVacantMatches: homeVacantN === expVacant || homeVacantN === 0,
  ltpStill110: parseInt(String(ltpTotal).replace(/\D/g, ''), 10) === expTotal,
  editModalOpens: editVacant.ok === true,
  heroFontSmaller: dash.heroFontPx >= 32 && dash.heroFontPx <= 40,
  receitaFontSmaller: dash.receitaFontPx >= 30 && dash.receitaFontPx <= 38,
  donutRendered: dash.chartDonut && dash.donutSegments >= 3,
  donutCenter110: parseInt(dash.donutCenter, 10) === expTotal,
  barSixMonths: dash.chartBar && dash.barMonthCount === 6,
};

console.log(JSON.stringify({ dash, checks, errors, editVacant, homeBefore, ltpBeforeDash, ltpTotal }, null, 2));
const pass = Object.values(checks).every(Boolean);
process.exit(pass ? 0 : 1);
