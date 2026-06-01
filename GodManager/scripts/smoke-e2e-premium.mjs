/**
 * Smoke E2E GodManager Premium — requer dev server em :3101 e DATABASE_URL (prod read).
 * Uso: DATABASE_URL="..." node /tmp/gm-e2e-smoke.mjs
 */
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3101';
const EMAIL = (process.env.SMOKE_EMAIL || 'info@managerprop.com').toLowerCase();

function sessionCookieValue(userId, role) {
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  return Buffer.from(JSON.stringify({ userId, role, exp })).toString('base64');
}

const KPI_IDS = [
  'ltp-kpi-total',
  'ltp-kpi-rented',
  'ltp-kpi-vacant',
  'ltp-kpi-inprog',
  'ltp-kpi-rent',
  'ltp-kpi-net',
  'ltp-kpi-total-deposit',
  'ltp-kpi-total-netowner',
  'ltp-kpi-total-exppm',
  'ltp-kpi-avg-mgm',
  'ltp-kpi-tenant-place',
  'ltp-kpi-reserva-seguranca',
];

const prisma = new PrismaClient();
const user = await prisma.user.findFirst({
  where: { email: { equals: EMAIL, mode: 'insensitive' } },
  select: { id: true, role: true, email: true, clientId: true, status: true },
});
if (!user) {
  console.error('FAIL: user not found:', EMAIL);
  process.exit(1);
}
if (user.status !== 'active') {
  console.error('FAIL: user not active:', user.status);
  process.exit(1);
}
const propCount = await prisma.property.count({
  where: { clientId: user.clientId ?? '__none__' },
});
console.log('DB:', { email: user.email, role: user.role, clientId: user.clientId, properties: propCount });
await prisma.$disconnect();

const cookieVal = sessionCookieValue(user.id, user.role);
const errors = [];
const warns = [];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.addCookies([
  {
    name: 'gm_auth',
    value: cookieVal,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  },
]);
const page = await context.newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (msg) => {
  const t = msg.type();
  const text = msg.text();
  if (t === 'error' && !/Failed to load resource/i.test(text)) errors.push(`console.error: ${text}`);
  if (t === 'warning' && /error|fail|bootstrap|denied|401|403/i.test(text)) {
    warns.push(`console.warn: ${text}`);
  }
});

await page.goto(`${BASE}/GodManager_Premium.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(
  () => document.querySelectorAll('#home-cards .card').length > 5,
  { timeout: 90000 },
).catch(() => {});

const home = await page.evaluate(() => {
  const cards = document.querySelectorAll('#home-cards .card');
  const empty = [...cards].filter((c) => c.classList.contains('empty')).length;
  const totalHouses = [...document.querySelectorAll('#home-cards .card')].find((el) => {
    const lab = el.querySelector('.cl');
    return lab && /TOTAL HOUSES/i.test(lab.textContent || '');
  });
  const val = totalHouses?.querySelector('.cv2')?.textContent?.trim() || '';
  const sample = [...document.querySelectorAll('#home-cards .card .cv2')]
    .slice(0, 6)
    .map((el) => el.textContent?.trim());
  return { cardCount: cards.length, emptyCards: empty, totalHousesValue: val, sampleValues: sample };
});

await page.evaluate(() => {
  if (typeof nav === 'function') nav('ltproperties');
});
await page.waitForFunction(
  () => {
    const t = document.getElementById('ltp-kpi-total');
    return t && String(t.textContent || '').trim() === '112';
  },
  { timeout: 90000 },
).catch(() => {});
await page.waitForTimeout(2000);

const ltp = await page.evaluate((ids) => {
  const kpis = {};
  for (const id of ids) {
    const el = document.getElementById(id);
    kpis[id] = (el?.textContent || '').trim();
  }
  const rows = document.querySelectorAll('#ltp-tbody tr').length;
  const addrs = [...document.querySelectorAll('#ltp-tbody tr')].slice(0, 8).map((tr) => {
    const tds = tr.querySelectorAll('td');
    return (tds[1]?.textContent || tds[0]?.textContent || '').trim();
  });
  const houseNums = addrs.map((a) => {
    const m = String(a).match(/^(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  });
  const counter = (document.getElementById('ltp-counter')?.textContent || '').trim();
  return { kpis, rowCount: rows, firstAddresses: addrs, houseNums, counter };
}, KPI_IDS);

function houseNumsSorted(nums) {
  const valid = nums.filter((n) => n != null);
  if (valid.length < 3) return false;
  for (let i = 1; i < valid.length; i++) {
    if (valid[i] < valid[i - 1]) return false;
  }
  return true;
}

let patchOnlyOk = null;
try {
  const editBtn = page.locator('#ltp-tbody button[data-ltp-a="edit"]').first();
  if ((await editBtn.count()) > 0) {
    await editBtn.click();
    await page.waitForTimeout(1500);
    const modal = page.locator('#ltp-property-modal');
    const visible = await modal.evaluate((el) => el && getComputedStyle(el).display !== 'none');
    const title = await page.locator('#ltp-modal-title').textContent();
    const editingId = await page.evaluate(() => window.__ltpEditingRecord?.id || window.__ltpEditingRecord?._apiId || null);
    const saveUsesPatch = await page.evaluate(() => {
      const fn = window.ltpSaveNewProperty;
      return fn && String(fn).includes("method='PATCH'") || String(fn).includes('method=\"PATCH\"');
    });
    await page.locator('#ltp-property-modal button').filter({ hasText: /Cancelar|Fechar|×/i }).first().click({ timeout: 2000 }).catch(() => {
      return page.keyboard.press('Escape');
    });
    patchOnlyOk = { modalVisible: visible, title: (title || '').trim(), editingId, saveUsesPatch };
  }
} catch (e) {
  patchOnlyOk = { error: String(e.message || e) };
}

await browser.close();

const report = {
  home,
  ltp,
  dbPropertyCount: propCount,
  patchEditCheck: patchOnlyOk,
  errors,
  warns,
};

const totalKpi = parseInt(String(ltp.kpis['ltp-kpi-total']).replace(/\D/g, ''), 10);
const rentedKpi = parseInt(String(ltp.kpis['ltp-kpi-rented']).replace(/\D/g, ''), 10);
const vacant = parseInt(String(ltp.kpis['ltp-kpi-vacant']).replace(/\D/g, ''), 10);
const homeTotal = parseInt(String(home.totalHousesValue).replace(/\D/g, ''), 10);
const checks = {
  noPageErrors: errors.length === 0,
  homeHasCards: home.cardCount > 0,
  homeTotal110: homeTotal === 110,
  ltpTotal110: totalKpi === 110,
  ltpRows110: ltp.rowCount === 110,
  rentedPlusVacant110: rentedKpi + vacant === 110,
  dbCount112: propCount === 112,
  vacantApprox: vacant >= 18 && vacant <= 22,
  addressSortNatural: houseNumsSorted(ltp.houseNums || []),
  allKpisNonEmpty: KPI_IDS.every((id) => {
    const v = ltp.kpis[id];
    return v && v !== '—';
  }),
};

console.log(JSON.stringify({ report, checks }, null, 2));

const pass =
  checks.noPageErrors &&
  checks.homeHasCards &&
  checks.homeTotal110 &&
  checks.ltpTotal110 &&
  checks.ltpRows110 &&
  checks.rentedPlusVacant110 &&
  checks.vacantApprox &&
  checks.addressSortNatural &&
  checks.allKpisNonEmpty;

process.exit(pass ? 0 : 1);
