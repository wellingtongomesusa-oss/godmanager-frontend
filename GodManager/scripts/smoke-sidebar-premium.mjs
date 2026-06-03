/**
 * Smoke sidebar colapsável — desktop viewport, dev :3101.
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
  select: { id: true, role: true, status: true },
});
if (!user || user.status !== 'active') {
  console.error('FAIL: user');
  process.exit(1);
}
await prisma.$disconnect();

const errors = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await context.addCookies([
  { name: 'gm_auth', value: sessionCookieValue(user.id, user.role), domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' },
]);
const page = await context.newPage();
page.setDefaultTimeout(120000);
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(`${BASE}/GodManager_Premium.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => document.querySelector('.sidebar'), { timeout: 60000 });

const initial = await page.evaluate(() => {
  const contentMl = parseFloat(getComputedStyle(document.querySelector('.content')).marginLeft) || 0;
  const collapsed = document.body.classList.contains('sidebar-collapsed');
  const brandHidden = getComputedStyle(document.querySelector('.sb-brand-text')).display === 'none';
  const btn = document.getElementById('sb-collapse-btn');
  return {
    contentMl,
    collapsed,
    brandHidden,
    btnVisible: btn ? getComputedStyle(btn).display !== 'none' : false,
    ariaExpanded: btn?.getAttribute('aria-expanded'),
    ls: localStorage.getItem('gm_sidebar_collapsed'),
  };
});

await page.click('#sb-collapse-btn');
await page.waitForTimeout(400);

const collapsed = await page.evaluate(() => {
  const contentMl = parseFloat(getComputedStyle(document.querySelector('.content')).marginLeft) || 0;
  const sidebarW = document.querySelector('.sidebar')?.getBoundingClientRect().width || 0;
  const brandHidden = getComputedStyle(document.querySelector('.sb-brand-text')).display === 'none';
  const lblHidden = getComputedStyle(document.querySelector('.sb-sec-lbl')).display === 'none';
  const props = document.getElementById('nav-ltproperties');
  const title = props?.getAttribute('title') || '';
  const short = props?.getAttribute('data-sb-short') || '';
  const btn = document.getElementById('sb-collapse-btn');
  return {
    contentMl,
    sidebarW,
    bodyCollapsed: document.body.classList.contains('sidebar-collapsed'),
    brandHidden,
    lblHidden,
    title,
    short,
    ls: localStorage.getItem('gm_sidebar_collapsed'),
    ariaExpanded: btn?.getAttribute('aria-expanded'),
  };
});

await page.click('#sb-collapse-btn');
await page.waitForTimeout(400);

const expanded = await page.evaluate(() => {
  const contentMl = parseFloat(getComputedStyle(document.querySelector('.content')).marginLeft) || 0;
  const brandDisplay = getComputedStyle(document.querySelector('.sb-brand-text')).display;
  const lblDisplay = getComputedStyle(document.querySelector('.sb-sec-lbl')).display;
  return {
    contentMl,
    bodyCollapsed: document.body.classList.contains('sidebar-collapsed'),
    brandVisible: brandDisplay !== 'none',
    lblVisible: lblDisplay !== 'none',
    ls: localStorage.getItem('gm_sidebar_collapsed'),
  };
});

await page.evaluate(() => {
  localStorage.setItem('gm_sidebar_collapsed', '1');
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(600);

const afterReload = await page.evaluate(() => ({
  collapsed: document.body.classList.contains('sidebar-collapsed'),
  ls: localStorage.getItem('gm_sidebar_collapsed'),
  contentMl: parseFloat(getComputedStyle(document.querySelector('.content')).marginLeft) || 0,
  sidebarW: document.querySelector('.sidebar')?.getBoundingClientRect().width || 0,
}));

await page.setViewportSize({ width: 390, height: 800 });
await page.waitForTimeout(300);
const mobile = await page.evaluate(() => ({
  collapsed: document.body.classList.contains('sidebar-collapsed'),
  btnDisplay: getComputedStyle(document.getElementById('sb-collapse-btn')).display,
  contentMl: parseFloat(getComputedStyle(document.querySelector('.content')).marginLeft) || 0,
}));

await browser.close();

const checks = {
  noPageErrors: errors.length === 0,
  initialExpanded: !initial.collapsed && initial.contentMl >= 180 && initial.brandHidden === false,
  collapseTo56: collapsed.bodyCollapsed && collapsed.sidebarW >= 52 && collapsed.sidebarW <= 60 && collapsed.contentMl >= 52 && collapsed.contentMl <= 60,
  collapseHidesBrand: collapsed.brandHidden && collapsed.lblHidden,
  collapseTitle: collapsed.title.length > 2,
  collapseShort: collapsed.short.length === 1,
  collapseLs: collapsed.ls === '1',
  expandBack: !expanded.bodyCollapsed && expanded.contentMl >= 180 && expanded.brandVisible && expanded.lblVisible,
  expandLs: expanded.ls === '0',
  persistReload: afterReload.collapsed && afterReload.ls === '1' && afterReload.sidebarW >= 52 && afterReload.sidebarW <= 60,
  mobileIgnoresCollapse: mobile.btnDisplay === 'none',
};

console.log(JSON.stringify({ initial, collapsed, expanded, afterReload, mobile, checks, errors }, null, 2));
const pass = Object.values(checks).every(Boolean);
process.exit(pass ? 0 : 1);
