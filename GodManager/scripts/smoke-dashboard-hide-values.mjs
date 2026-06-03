/**
 * Smoke — toggle Ocultar valores no Dashboard (#page-longterm).
 */
import { chromium } from 'playwright';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3101';
const EMAIL = (process.env.SMOKE_EMAIL || 'info@managerprop.com').toLowerCase();

function sessionCookieValue(userId, role) {
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  return Buffer.from(JSON.stringify({ userId, role, exp })).toString('base64');
}

let userId = process.env.SMOKE_USER_ID;
let role = process.env.SMOKE_USER_ROLE || 'admin';

if (!userId) {
  const { PrismaClient } = await import('@prisma/client');
  const p = new PrismaClient();
  try {
    const user = await p.user.findFirst({
      where: { email: { equals: EMAIL, mode: 'insensitive' } },
      select: { id: true, role: true, status: true },
    });
    if (!user || user.status !== 'active') {
      console.error('FAIL: user');
      process.exit(1);
    }
    userId = user.id;
    role = user.role;
  } finally {
    await p.$disconnect();
  }
}

const errors = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.addInitScript(({ userId, role, email }) => {
  window.__gmCurrentUser = { id: userId, role, email, status: 'active' };
}, { userId, role, email: EMAIL });
await context.addCookies([
  {
    name: 'gm_auth',
    value: sessionCookieValue(userId, role),
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  },
]);
const page = await context.newPage();
page.setDefaultTimeout(120000);
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.route('**/api/**', async (route) => {
  const url = route.request().url();
  if (
    /\/api\/(properties|pm\/expenses|auth|news)/.test(url) ||
    url.includes('/api/tenant')
  ) {
    await route.continue();
    return;
  }
  const method = route.request().method();
  if (method === 'GET' || method === 'HEAD') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, items: [], photos: [], data: [], expenses: [] }),
    });
    return;
  }
  await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
});

await page.goto(`${BASE}/GodManager_Premium.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(800);
await page.evaluate(() => {
  try {
    localStorage.removeItem('gm_dashboard_values_hidden');
    document.body.classList.remove('dashboard-values-hidden');
  } catch (e) {}
});

await page.evaluate(() => {
  if (typeof nav === 'function') nav('longterm');
});
await page.waitForTimeout(2500);

const initial = await page.evaluate(() => {
  const btn = document.getElementById('gm-dash-toggle-values');
  const hero = document.getElementById('ltd-hero-vacant-count');
  const bodyHidden = document.body.classList.contains('dashboard-values-hidden');
  const ls = localStorage.getItem('gm_dashboard_values_hidden');
  return {
    btnVisible: !!btn && btn.offsetParent !== null,
    btnLabel: btn?.querySelector('.gm-dash-toggle-label')?.textContent || '',
    ariaPressed: btn?.getAttribute('aria-pressed'),
    bodyHidden,
    ls,
    heroText: hero?.textContent || '',
  };
});

await page.click('#gm-dash-toggle-values');
await page.waitForTimeout(600);

const hidden = await page.evaluate(() => {
  function isValMasked(el) {
    if (!el || !document.body.classList.contains('dashboard-values-hidden')) return false;
    const c = getComputedStyle(el).color;
    return c === 'transparent' || c === 'rgba(0, 0, 0, 0)';
  }
  const hero = document.getElementById('ltd-hero-vacant-count');
  const receita = document.getElementById('ltd-receita-value');
  const strip = document.getElementById('ltd-strip-total');
  const jobVal = document.querySelector('#ltd-jobs-tbody .gm-sensitive-val');
  const btn = document.getElementById('gm-dash-toggle-values');
  const charts = window.__ltdDashCharts || {};
  let yTick = null;
  let tooltipOff = null;
  if (charts.bar && charts.bar.options?.scales?.y?.ticks?.callback) {
    yTick = charts.bar.options.scales.y.ticks.callback(1000);
  }
  if (charts.bar && charts.bar.options?.plugins?.tooltip) {
    tooltipOff = charts.bar.options.plugins.tooltip.enabled === false;
  }
  return {
    bodyHidden: document.body.classList.contains('dashboard-values-hidden'),
    ls: localStorage.getItem('gm_dashboard_values_hidden'),
    btnLabel: btn?.querySelector('.gm-dash-toggle-label')?.textContent || '',
    ariaPressed: btn?.getAttribute('aria-pressed'),
    heroMasked: isValMasked(hero),
    receitaMasked: isValMasked(receita),
    stripMasked: isValMasked(strip),
    jobValMasked: jobVal ? isValMasked(jobVal) : true,
    chartYTick: yTick,
    chartTooltipOff: tooltipOff,
  };
});

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  if (typeof nav === 'function') nav('longterm');
});
await page.waitForTimeout(2500);

const afterReload = await page.evaluate(() => ({
  bodyHidden: document.body.classList.contains('dashboard-values-hidden'),
  ls: localStorage.getItem('gm_dashboard_values_hidden'),
}));

await page.click('#gm-dash-toggle-values');
await page.waitForTimeout(500);

const visibleAgain = await page.evaluate(() => {
  function isValMasked(el) {
    if (!el || !document.body.classList.contains('dashboard-values-hidden')) return false;
    const c = getComputedStyle(el).color;
    return c === 'transparent' || c === 'rgba(0, 0, 0, 0)';
  }
  const hero = document.getElementById('ltd-hero-vacant-count');
  const btn = document.getElementById('gm-dash-toggle-values');
  return {
    bodyHidden: document.body.classList.contains('dashboard-values-hidden'),
    ls: localStorage.getItem('gm_dashboard_values_hidden'),
    btnLabel: btn?.querySelector('.gm-dash-toggle-label')?.textContent || '',
    heroMasked: isValMasked(hero),
    heroHasDigits: /\d/.test(hero?.textContent || ''),
  };
});

await page.evaluate(() => {
  if (typeof nav === 'function') nav('home');
});
await page.waitForTimeout(800);
const homeOk = await page.evaluate(() => !!document.getElementById('page-home'));

await page.evaluate(() => {
  if (typeof nav === 'function') nav('properties');
});
await page.waitForTimeout(800);
const propsOk = await page.evaluate(() => !!document.getElementById('page-properties'));

await page.evaluate(() => {
  try {
    localStorage.setItem('gm_dashboard_values_hidden', '0');
    document.body.classList.remove('dashboard-values-hidden');
  } catch (e) {}
});

await browser.close();

const checks = {
  btnVisible: initial.btnVisible,
  initialVisible: initial.bodyHidden === false && initial.ls !== '1',
  hideWorks:
    hidden.bodyHidden &&
    hidden.ls === '1' &&
    hidden.ariaPressed === 'true' &&
    hidden.btnLabel.includes('Mostrar') &&
    hidden.heroMasked &&
    hidden.receitaMasked &&
    hidden.stripMasked,
  chartYMasked: hidden.chartYTick === '•••',
  chartTooltipOff: hidden.chartTooltipOff === true,
  persistAfterReload: afterReload.bodyHidden && afterReload.ls === '1',
  showAgain:
    visibleAgain.bodyHidden === false &&
    visibleAgain.ls === '0' &&
    visibleAgain.btnLabel.includes('Ocultar') &&
    !visibleAgain.heroMasked,
  homeNavOk: homeOk,
  propsNavOk: propsOk,
  noPageErrors: errors.length === 0,
};

console.log(JSON.stringify({ initial, hidden, afterReload, visibleAgain, checks, errors }, null, 2));
process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
