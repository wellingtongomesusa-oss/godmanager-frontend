/**
 * Smoke — Evolucao do Portfolio (timeline 12m + metas) no Dashboard.
 */
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3101';
const MP_EMAIL = (process.env.SMOKE_EMAIL || 'info@managerprop.com').toLowerCase();
const MVH_EMAIL = (process.env.SMOKE_MVH_EMAIL || 'audit@mastervacationhomes.com').toLowerCase();
const MP_CLIENT_ID = 'cmoqec9bw0000057uu4p5h15a';
const MVH_CLIENT_ID = 'cmpejrwoe000ap64xkegrzsho';
const DEFAULT_MP_USER_ID = 'cmobuxca50000p81wp4llstd7';
const DEFAULT_MVH_USER_ID = 'cmpejrwom000cp64xktfc5skl';

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

async function resolveUsers() {
  const mpFromEnv = process.env.SMOKE_MP_USER_ID || DEFAULT_MP_USER_ID;
  const mvhFromEnv = process.env.SMOKE_MVH_USER_ID || DEFAULT_MVH_USER_ID;
  if (mpFromEnv) {
    return {
      mp: {
        id: mpFromEnv,
        role: process.env.SMOKE_MP_ROLE || 'admin',
        status: 'active',
        clientId: MP_CLIENT_ID,
      },
      mvh: mvhFromEnv
        ? {
            id: mvhFromEnv,
            role: process.env.SMOKE_MVH_ROLE || 'admin',
            status: 'active',
            clientId: MVH_CLIENT_ID,
          }
        : null,
    };
  }
  return prismaOnce(async (p) => {
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
}

const users = await resolveUsers();

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
  await page.evaluate(async () => {
    try {
      if (typeof gmPropertiesFetchFromApi === 'function') {
        const fresh = await gmPropertiesFetchFromApi();
        if (fresh?.length && typeof gmPropertiesSave === 'function') gmPropertiesSave(fresh);
      }
    } catch (e) {
      /* ignore */
    }
    if (typeof nav === 'function') nav('longterm');
    await new Promise((r) => setTimeout(r, 80));
    if (typeof ltDashRender === 'function') await ltDashRender();
  });
  await page.waitForTimeout(1500);

  const dash = await page.evaluate(() => {
    const card = document.getElementById('ltd-timeline-card');
    const note = document.querySelector('.ltd-timeline-note');
    const chart = window.__ltdDashCharts?.timeline;
    const stripTotal = document.getElementById('ltd-strip-total');
    const goalLabels = document.querySelectorAll('.ltd-timeline-goal-label');
    const barDs = chart?.data?.datasets?.[0];
    const lineDs = (chart?.data?.datasets || []).slice(1);
    const payload = window.__gmDashTimelineLastPayload;
    const lastCount =
      payload?.months?.length ? payload.months[payload.months.length - 1].count : null;
    const lastBar =
      barDs?.data?.length ? barDs.data[barDs.data.length - 1] : null;
    const stripNum = Number(String(stripTotal?.textContent || '').replace(/[^\d]/g, '') || 0);
    const yTicks = chart?.scales?.y?.ticks || [];
    return {
      cardShown: card && getComputedStyle(card).display !== 'none',
      noteText: note?.textContent || '',
      barCount: barDs?.data?.length || 0,
      lineCount: lineDs.length,
      lineValues: lineDs.map((d) => d.data?.[0]),
      yMax: chart?.options?.scales?.y?.max,
      goalLabelCount: goalLabels.length,
      goalLabelTexts: Array.from(goalLabels).map((el) => el.textContent),
      lastCount,
      lastBar,
      stripNum,
      tooltipEnabled: chart?.options?.plugins?.tooltip?.enabled,
      yTickSample: yTicks[1]?.label ?? yTicks[1] ?? null,
    };
  });

  await page.click('#gm-dash-toggle-values');
  await page.waitForTimeout(500);
  const afterHide = await page.evaluate(() => {
    const chart = window.__ltdDashCharts?.timeline;
    const goalLabels = document.querySelectorAll('.ltd-timeline-goal-label');
    const yTicks = chart?.scales?.y?.ticks || [];
    const tickLabel =
      typeof yTicks[2] === 'object' && yTicks[2] != null
        ? yTicks[2].label
        : String(yTicks[2] ?? '');
    return {
      bodyHidden: document.body.classList.contains('dashboard-values-hidden'),
      tooltipOff: chart?.options?.plugins?.tooltip?.enabled === false,
      yTickMasked: tickLabel === '•••' || tickLabel.includes('•••'),
      goalLabelsStillVisible: goalLabels.length >= 3,
    };
  });

  await browser.close();
  return { dash, afterHide };
}

const mpResult = await runDashCheck(users.mp, 'mp');
let mvhResult = { dash: { cardShown: false, barCount: 0 }, afterHide: {} };
if (users.mvh?.id && users.mvh.status === 'active') {
  mvhResult = await runDashCheck(users.mvh, 'mvh');
} else {
  console.warn('WARN: MVH user not found — skipping second-user check');
}

const mp = mpResult.dash;
const checks = {
  mpTimelineVisible: mp.cardShown,
  mpNoteLimitation: /cadastro/i.test(mp.noteText) && /portfolio/i.test(mp.noteText),
  mpTwelveBars: mp.barCount === 12,
  mpThreeGoalLines: mp.lineCount === 3,
  mpGoalValues142213320:
    mp.lineValues?.[0] === 142 && mp.lineValues?.[1] === 213 && mp.lineValues?.[2] === 320,
  mpGoalLabels: mp.goalLabelCount >= 3 && /Meta Fase 1: 142/.test(mp.goalLabelTexts?.join(' ') || ''),
  mpYMaxAtLeast320: (mp.yMax || 0) >= 320,
  mpCountMatchesStrip:
    mp.lastCount === mp.stripNum &&
    mp.lastBar === mp.stripNum &&
    mp.stripNum > 0,
  mpTooltipOn: mp.tooltipEnabled !== false,
  mvhTimelineVisible: mvhResult.dash.cardShown && mvhResult.dash.barCount === 12,
  hideYMasked: mpResult.afterHide.yTickMasked,
  hideTooltipOff: mpResult.afterHide.tooltipOff,
  hideGoalsVisible: mpResult.afterHide.goalLabelsStillVisible,
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
