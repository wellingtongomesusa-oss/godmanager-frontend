/**
 * Smoke — card Regra de Participacao no Dashboard (Manager Prop only).
 */
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3101';
const MP_EMAIL = (process.env.SMOKE_EMAIL || 'info@managerprop.com').toLowerCase();
const MVH_EMAIL = (process.env.SMOKE_MVH_EMAIL || 'audit@mastervacationhomes.com').toLowerCase();
const MP_CLIENT_ID = 'cmoqec9bw0000057uu4p5h15a';

function sessionCookieValue(userId, role) {
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  return Buffer.from(JSON.stringify({ userId, role, exp })).toString('base64');
}

async function prismaOnce(fn) {
  const p = new PrismaClient();
  try {
    return await fn(p);
  } finally {
    await p.$disconnect();
  }
}

const users = await prismaOnce(async (p) => {
  const mp = await p.user.findFirst({
    where: { email: { equals: MP_EMAIL, mode: 'insensitive' } },
    select: { id: true, role: true, status: true, clientId: true },
  });
  const mvh = await p.user.findFirst({
    where: { email: { equals: MVH_EMAIL, mode: 'insensitive' } },
    select: { id: true, role: true, status: true, clientId: true },
  });
  return { mp, mvh };
});

if (!users.mp?.id || users.mp.status !== 'active') {
  console.error('FAIL: MP user');
  process.exit(1);
}

const errors = [];

async function runDashCheck(user, label) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(
    ({ userId, role, email, clientId }) => {
      window.__gmCurrentUser = { id: userId, role, email, status: 'active', clientId: clientId || null };
    },
    {
      userId: user.id,
      role: user.role,
      email: label === 'mp' ? MP_EMAIL : MVH_EMAIL,
      clientId: user.clientId,
    },
  );
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
  page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));

  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (/\/api\/(properties|pm\/expenses|auth)/.test(url)) {
      await route.continue();
      return;
    }
    const method = route.request().method();
    if (method === 'GET' || method === 'HEAD') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, properties: [], expenses: [], items: [] }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto(`${BASE}/GodManager_Premium.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    if (typeof nav === 'function') nav('longterm');
  });
  await page.waitForTimeout(3500);

  const dash = await page.evaluate((mpClientId) => {
    const card = document.getElementById('ltd-participation-card');
    const title = document.getElementById('ltd-participation-kpi-title');
    const count = document.getElementById('ltd-participation-kpi-count');
    const split = document.getElementById('ltd-participation-split');
    const marker = document.getElementById('ltd-participation-marker');
    const chart = window.__ltdDashCharts?.participation;
    const stripTotal = document.getElementById('ltd-strip-total');
    const u = window.__gmCurrentUser || {};
    const visibleFn =
      typeof gmDashParticipationClientVisible === 'function'
        ? gmDashParticipationClientVisible()
        : false;
    return {
      clientId: u.clientId || null,
      visibleFn,
      cardDisplay: card ? getComputedStyle(card).display : 'none',
      cardShown: card && getComputedStyle(card).display !== 'none',
      titleText: title?.textContent || '',
      countText: count?.textContent || '',
      splitText: split?.textContent || '',
      markerDisplay: marker ? getComputedStyle(marker).display : 'none',
      chartBars: chart?.data?.datasets?.[0]?.data?.length || 0,
      chartMax: chart?.options?.scales?.x?.max,
      stripTotal: stripTotal?.textContent || '',
      phaseFn:
        typeof gmPhaseFromCount === 'function' && stripTotal
          ? gmPhaseFromCount(Number(String(stripTotal).replace(/[^\d]/g, '') || 0))?.label
          : null,
    };
  }, MP_CLIENT_ID);

  await page.click('#gm-dash-toggle-values');
  await page.waitForTimeout(400);
  const afterHide = await page.evaluate(() => {
    const count = document.getElementById('ltd-participation-kpi-count');
    const split = document.getElementById('ltd-participation-split');
    return {
      bodyHidden: document.body.classList.contains('dashboard-values-hidden'),
      countMasked: count
        ? getComputedStyle(count).color === 'transparent' ||
          getComputedStyle(count).color === 'rgba(0, 0, 0, 0)'
        : false,
      splitVisible: split ? getComputedStyle(split).color !== 'transparent' : false,
      splitText: split?.textContent || '',
    };
  });

  await browser.close();
  return { dash, afterHide };
}

const mpResult = await runDashCheck(users.mp, 'mp');
let mvhResult = { dash: { cardShown: false, visibleFn: false }, afterHide: {} };
if (users.mvh?.id && users.mvh.status === 'active') {
  mvhResult = await runDashCheck(users.mvh, 'mvh');
} else {
  console.warn('WARN: MVH user not found — skipping second-user check');
}

const mp = mpResult.dash;
const checks = {
  mpClientIdOk: String(users.mp.clientId) === MP_CLIENT_ID,
  mpCardVisible: mp.cardShown && mp.visibleFn,
  mpTitleHasFase: /Fase/i.test(mp.titleText),
  mpCountHasCasas: /casas/i.test(mp.countText) && /\//.test(mp.countText),
  mpSplitLucro25OrPhase:
    mp.splitText.includes('Lucro') && mp.splitText.includes('Equity'),
  mpChartFourBars: mp.chartBars === 4,
  mpChartMax320: mp.chartMax === 320,
  mpMarkerShown: mp.markerDisplay !== 'none',
  mvhCardHidden: !mvhResult.dash.cardShown,
  hideMasksCountNotSplit:
    mpResult.afterHide.bodyHidden &&
    mpResult.afterHide.countMasked &&
    mpResult.afterHide.splitVisible,
  noPageErrors: errors.length === 0,
};

console.log(
  JSON.stringify(
    {
      users: {
        mp: { email: MP_EMAIL, clientId: users.mp.clientId },
        mvh: users.mvh
          ? { email: MVH_EMAIL, clientId: users.mvh.clientId }
          : null,
      },
      mp: mpResult,
      mvh: mvhResult,
      checks,
      errors,
    },
    null,
    2,
  ),
);

const pass = Object.values(checks).every(Boolean);
process.exit(pass ? 0 : 1);
