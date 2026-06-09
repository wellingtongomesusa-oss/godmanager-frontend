/**
 * Smoke — Forms Received (#page-forms-received, dark escopado).
 * Requer: next start :3101, DATABASE_URL.
 * Prova por DOM real (viewport 1400px):
 *  - nav('forms-received') ativa #page-forms-received (não #page-home);
 *  - bg dark rgb(10,9,6) no page e #home-cards .card continua claro (sem vazamento);
 *  - 6 donuts fr-card-* (incl. Total Tenants) com Chart instance própria (__frCharts);
 *  - 3 charts fr-chart-* renderizam; ltd-* intactos após visitar forms-received;
 *  - re-entrada re-renderiza (live): instance id muda;
 *  - olho mascara fr-chart-net (blur + overlay); master alterna os dois; contagens não mascaram;
 *  - sem pageerror.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3101';
const __dir = dirname(fileURLToPath(import.meta.url));
const users = JSON.parse(readFileSync(join(__dir, '.smoke-vendor-free-users.json'), 'utf8'));

async function resolveDbAdmin() {
  // cookie precisa apontar pra um user existente no DB deste ambiente (getCurrentUserFromSession)
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const u = await prisma.user.findFirst({ where: { role: { in: ['super_admin', 'admin'] } }, select: { id: true, role: true } });
    await prisma.$disconnect();
    if (u) return u;
  } catch (e) {
    console.warn('resolveDbAdmin fallback:', e.message);
  }
  return { id: users.admin.id, role: users.admin.role };
}

function sessionCookieValue(userId, role) {
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  return Buffer.from(JSON.stringify({ userId, role, exp })).toString('base64');
}

const MOCK_PROPS = [
  { id: 'P0044', address: '6483 Trailblaze Bend', owner: 'NDB Real Estate', tenant: '', rent: 2300, deposit: 0, mgmpct: 8, status: 'pending', occupancy: 'vacant', month: '2026-06' },
  { id: 'P0085', address: '7686 Agrigento Street Clermont, FL 34714', owner: 'Shayra B LLC', tenant: 'Jovanka L. Romero', rent: 2600, deposit: 2600, mgmpct: 8, status: 'approved', occupancy: 'rented', month: '2026-06' },
  { id: 'P0100', address: '123 Smoke Test Ave Orlando, FL 32801', owner: 'Smoke Owner LLC', tenant: 'Test Tenant', rent: 1800, deposit: 1800, mgmpct: 10, status: 'approved', occupancy: 'rented', month: '2026-06' },
];

function rgbLuma(rgb) {
  const m = String(rgb || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return -1;
  return 0.2126 * +m[1] + 0.7152 * +m[2] + 0.0722 * +m[3];
}

async function main() {
  const dbAdmin = await resolveDbAdmin();
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await context.addCookies([
    { name: 'gm_auth', value: sessionCookieValue(dbAdmin.id, dbAdmin.role), domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' },
  ]);
  const page = await context.newPage();
  const errors = [];
  const consoleErrors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/Failed to load resource/i.test(msg.text())) consoleErrors.push(msg.text());
  });
  page.setDefaultTimeout(120000);

  try {
    await page.goto(`${BASE}/GodManager_Premium.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => typeof nav === 'function' && typeof Chart !== 'undefined', { timeout: 60000 });

    // mocks determinísticos + gate super_admin (forms-received está em ADMIN_PLATFORM_ROUTES)
    await page.evaluate((mocks) => {
      window.gmPropertiesSave(mocks);
      window.gmPropertiesFetchFromApi = async () => null; // não sobrescrever mocks via API
      window.__gmCurrentUser = Object.assign({}, window.__gmCurrentUser || {}, { role: 'super_admin' });
    }, MOCK_PROPS);

    // baseline ltd-* (Dashboard Long Term) ANTES de visitar forms-received
    await page.evaluate(() => nav('longterm'));
    await page.waitForTimeout(4000);
    const ltdBefore = await page.evaluate(() => ({
      portfolio: !!Chart.getChart(document.getElementById('ltd-portfolio-timeline-chart') || undefined),
      net: !!Chart.getChart(document.getElementById('ltd-net-line-chart') || undefined),
      portfolioCanvas: !!document.getElementById('ltd-portfolio-timeline-chart'),
      netCanvas: !!document.getElementById('ltd-net-line-chart'),
    }));

    // entrar em forms-received e aguardar render (donut houses como sentinela)
    // re-aplicar role no MESMO tick do nav (bootstrap /api/auth/me pode ter sobrescrito __gmCurrentUser)
    await page.evaluate(() => {
      window.__gmCurrentUser = Object.assign({}, window.__gmCurrentUser || {}, { role: 'super_admin' });
      nav('forms-received');
    });
    await page.waitForFunction(() => !!(window.__frCharts && window.__frCharts.cardHouses), { timeout: 30000 });
    await page.waitForTimeout(1500); // charts de evolução (fetch)

    const snap1 = await page.evaluate(() => {
      const fr = document.getElementById('page-forms-received');
      const home = document.getElementById('page-home');
      const donutIds = ['fr-card-houses', 'fr-card-rented', 'fr-card-owners', 'fr-card-vacant', 'fr-card-moveout', 'fr-card-tenants'];
      const chartIds = ['fr-chart-houses', 'fr-chart-net', 'fr-chart-portfolio'];
      return {
        frActive: !!(fr && fr.classList.contains('active')),
        homeActive: !!(home && home.classList.contains('active')),
        frBg: fr ? getComputedStyle(fr).backgroundColor : '',
        h1Text: (fr.querySelector('.fr-title') || {}).textContent || '',
        donuts: donutIds.map((id) => !!Chart.getChart(document.getElementById(id) || undefined)),
        donutRegistryCount: Object.keys(window.__frCharts || {}).filter((k) => k.startsWith('card')).length,
        charts: chartIds.map((id) => !!Chart.getChart(document.getElementById(id) || undefined)),
        tenantsNum: (document.getElementById('fr-num-tenants') || {}).textContent || '',
        housesNum: (document.getElementById('fr-num-houses') || {}).textContent || '',
        housesChartInstanceId: window.__frCharts && window.__frCharts.cardHouses ? window.__frCharts.cardHouses.id : -1,
      };
    });

    // ltd-* intactos após visitar forms-received (instâncias não destruídas, ids não colididos)
    const ltdAfter = await page.evaluate(() => ({
      portfolio: !!Chart.getChart(document.getElementById('ltd-portfolio-timeline-chart') || undefined),
      net: !!Chart.getChart(document.getElementById('ltd-net-line-chart') || undefined),
      frRegistryHasLtd: Object.keys(window.__frCharts || {}).some((k) => k.includes('ltd')),
    }));

    // sem vazamento: Home continua claro
    const homeLeak = await page.evaluate(async () => {
      nav('home');
      if (typeof renderCards === 'function') { try { renderCards(); } catch (e) {} }
      await new Promise((r) => setTimeout(r, 600));
      const card = document.querySelector('#home-cards .card');
      const homePage = document.getElementById('page-home');
      return {
        cardBg: card ? getComputedStyle(card).backgroundColor : null,
        homeBg: homePage ? getComputedStyle(homePage).backgroundColor : '',
        homeActive: !!(homePage && homePage.classList.contains('active')),
      };
    });

    // LIVE: re-entrada re-renderiza (instance id do donut muda)
    await page.evaluate(() => {
      window.__gmCurrentUser = Object.assign({}, window.__gmCurrentUser || {}, { role: 'super_admin' });
      nav('forms-received');
    });
    await page.waitForFunction((prev) => !!(window.__frCharts && window.__frCharts.cardHouses && window.__frCharts.cardHouses.id !== prev), snap1.housesChartInstanceId, { timeout: 30000 });
    await page.waitForTimeout(1200);

    // HIDE: olho do net
    await page.click('#fr-eye-net');
    const mask1 = await page.evaluate(() => {
      const wrapNet = document.getElementById('fr-wrap-net');
      const wrapPort = document.getElementById('fr-wrap-portfolio');
      const cvNet = document.getElementById('fr-chart-net');
      const ovNet = wrapNet.querySelector('.fr-mask-overlay');
      return {
        netMasked: wrapNet.classList.contains('fr-masked'),
        portMasked: wrapPort.classList.contains('fr-masked'),
        netBlur: getComputedStyle(cvNet).filter.includes('blur'),
        netOverlayShown: getComputedStyle(ovNet).display === 'flex',
        sessionState: sessionStorage.getItem('fr_hide_v1') || '',
      };
    });

    // master: liga os dois; segundo clique desliga os dois
    await page.click('#fr-master-hide');
    const mask2 = await page.evaluate(() => ({
      netMasked: document.getElementById('fr-wrap-net').classList.contains('fr-masked'),
      portMasked: document.getElementById('fr-wrap-portfolio').classList.contains('fr-masked'),
      portBlur: getComputedStyle(document.getElementById('fr-chart-portfolio')).filter.includes('blur'),
      masterLbl: (document.getElementById('fr-master-hide-lbl') || {}).textContent || '',
      cardsMasked: !!document.querySelector('#fr-cards .fr-masked'),
      cardCanvasBlur: getComputedStyle(document.getElementById('fr-card-houses')).filter.includes('blur'),
    }));
    await page.click('#fr-master-hide');
    const mask3 = await page.evaluate(() => ({
      netMasked: document.getElementById('fr-wrap-net').classList.contains('fr-masked'),
      portMasked: document.getElementById('fr-wrap-portfolio').classList.contains('fr-masked'),
      masterLbl: (document.getElementById('fr-master-hide-lbl') || {}).textContent || '',
    }));

    const checks = {
      navShowsFormsReceived: snap1.frActive && !snap1.homeActive,
      darkBg: snap1.frBg === 'rgb(10, 9, 6)',
      h1Brand: snap1.h1Text.trim() === 'Manager Prop 2026',
      sixDonuts: snap1.donuts.length === 6 && snap1.donuts.every(Boolean) && snap1.donutRegistryCount === 6,
      tenantsCardNumeric: /^\d+$/.test(snap1.tenantsNum.trim()),
      housesCount: snap1.housesNum.trim() === '3',
      threeCharts: snap1.charts.every(Boolean),
      ltdIntact: (!ltdBefore.portfolio || ltdAfter.portfolio) && (!ltdBefore.net || ltdAfter.net) && !ltdAfter.frRegistryHasLtd,
      homeNoLeak: homeLeak.homeActive && (homeLeak.cardBg ? rgbLuma(homeLeak.cardBg) > 150 : rgbLuma(homeLeak.homeBg) !== rgbLuma('rgb(10,9,6)')),
      liveReRender: true, // garantido pelo waitForFunction acima (id mudou)
      eyeMasksNetOnly: mask1.netMasked && !mask1.portMasked && mask1.netBlur && mask1.netOverlayShown && mask1.sessionState.includes('"net":true'),
      masterMasksBoth: mask2.netMasked && mask2.portMasked && mask2.portBlur && mask2.masterLbl === 'Mostrar financeiro',
      countsNotMasked: !mask2.cardsMasked && !mask2.cardCanvasBlur,
      masterUnmasksBoth: !mask3.netMasked && !mask3.portMasked && mask3.masterLbl === 'Ocultar financeiro',
      noPageErrors: errors.length === 0,
      noConsoleErrors: consoleErrors.length === 0,
    };
    const pass = Object.values(checks).every(Boolean);
    console.log(JSON.stringify({ pass, checks, snap1, ltdBefore, ltdAfter, homeLeak, mask1, mask2, mask3, errors, consoleErrors }, null, 2));
    process.exit(pass ? 0 : 1);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error('SMOKE FAILED:', e);
  process.exit(1);
});
