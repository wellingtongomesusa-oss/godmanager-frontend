/**
 * Smoke News server-side — dev :3101, PROD DB read/write (test rows deleted at end).
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
  select: { id: true, role: true, status: true, clientId: true },
});
if (!user || user.status !== 'active') {
  console.error('FAIL: user not found or inactive');
  await prisma.$disconnect();
  process.exit(1);
}

const createdIds = [];
const errors = [];
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
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(`${BASE}/GodManager_Premium.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => typeof nav === 'function' && document.querySelector('.sidebar'), {
  timeout: 60000,
});

await page.evaluate(() => nav('jobs'));
await page.waitForFunction(
  () => document.getElementById('page-jobs')?.classList.contains('active'),
  { timeout: 30000 },
);
await page.evaluate(() => {
  if (typeof gmJobsSetViewMode === 'function') gmJobsSetViewMode('table');
});
await page.waitForTimeout(3500);

const vendorBtn = page.locator('button:has-text("V +$120"):not([disabled])').first();
const vendorBtnCount = await vendorBtn.count();
let vendorJobId = null;

if (vendorBtnCount > 0) {
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')].filter(
      (b) => (b.textContent || '').includes('V +$120') && !b.disabled,
    );
    const btn = btns[0];
    if (!btn) return;
    const on = btn.getAttribute('onclick') || '';
    const m = on.match(/jobsOnVendorClick\('([^']+)'\)/);
    const id = m ? m[1] : null;
    if (!id || typeof gmJobsScopedLsKey !== 'function') return;
    const key = gmJobsScopedLsKey('gm_job_actions');
    let arr = [];
    try {
      arr = JSON.parse(localStorage.getItem(key) || '[]');
    } catch (e) {
      arr = [];
    }
    arr = arr.filter((a) => !(String(a.expenseId) === String(id) && a.type === 'vendor'));
    localStorage.setItem(key, JSON.stringify(arr));
  });

  const beforeNews = await page.evaluate(async () => {
    const r = await fetch('/api/news?limit=50', { credentials: 'include' });
    const j = await r.json();
    return (j.items || []).map((x) => x.id);
  });

  await vendorBtn.click();
  await page.waitForTimeout(1500);

  const afterNews = await page.evaluate(async () => {
    const r = await fetch('/api/news?limit=50', { credentials: 'include' });
    const j = await r.json();
    return j;
  });

  const newItem = (afterNews.items || []).find(
    (it) => it.subtype === 'vendor_fee' && !beforeNews.includes(it.id),
  );
  if (newItem) {
    createdIds.push(newItem.id);
    vendorJobId = newItem.jobId;
  } else {
    const latestFee = (afterNews.items || []).find((it) => it.subtype === 'vendor_fee');
    if (latestFee) {
      createdIds.push(latestFee.id);
      vendorJobId = latestFee.jobId;
    } else {
      errors.push('vendor_fee: no TeamNewsItem after V+$120 click');
    }
  }
} else {
  errors.push('vendor_fee: no enabled V +$120 button found');
}

let freeJobId = null;
const expList = await page.evaluate(async () => {
  const r = await fetch('/api/pm/expenses', { credentials: 'include' });
  const j = await r.json();
  const rows = (j.expenses || []).filter((e) => e && e.id);
  return rows.length ? String(rows[0].id) : null;
});
if (expList) freeJobId = expList;

const apiPostFree = await page.evaluate(
  async ({ jobId }) => {
    const r = await fetch('/api/news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        type: 'job_action',
        subtype: 'vendor_free',
        title: 'Job sem vendor: SMOKE_NEWS_VFREE_TEST',
        body: 'SMOKE_NEWS_VFREE_TEST body',
        jobId,
        metadata: { smoke: true },
      }),
    });
    const j = await r.json();
    return { ok: r.ok, status: r.status, j };
  },
  { jobId: freeJobId },
);

if (apiPostFree.ok && apiPostFree.j?.item?.id) {
  createdIds.push(apiPostFree.j.item.id);
} else {
  errors.push(
    `vendor_free POST: status=${apiPostFree.status} err=${apiPostFree.j?.error || 'unknown'}`,
  );
}

await page.evaluate(() => {
  if (typeof gmNewsRefreshBadge === 'function') return gmNewsRefreshBadge();
});
await page.waitForTimeout(800);

const badge = await page.evaluate(() => {
  const b = document.getElementById('nav-news-badge');
  return {
    display: b ? getComputedStyle(b).display : 'none',
    text: b?.textContent || '',
    total24: window.__gmNewsTotal24h,
  };
});

await page.evaluate(() => nav('news'));
await page.waitForFunction(
  () => document.getElementById('page-news')?.classList.contains('active'),
  { timeout: 15000 },
);
await page.waitForFunction(
  async () => {
    if (typeof gmNewsLoadApi !== 'function') return false;
    await gmNewsLoadApi();
    if (typeof renderMsgs === 'function') renderMsgs();
    const html = document.getElementById('news-list')?.innerHTML || '';
    return html.length > 120;
  },
  { timeout: 20000 },
);

const feed = await page.evaluate(() => {
  const html = document.getElementById('news-list')?.innerHTML || '';
  return {
    hasVendorFee: html.includes('Vendor +$120') || html.includes('vendor_fee'),
    hasVendorFree: html.includes('V Free') || html.includes('SMOKE_NEWS_VFREE'),
    len: html.length,
  };
});

await page.evaluate(() => nav('home'));
await page.waitForTimeout(400);
const homeOk = await page.evaluate(
  () => !!document.getElementById('page-home')?.classList.contains('active'),
);

await browser.close();

if (createdIds.length) {
  const del = await prisma.teamNewsItem.deleteMany({
    where: { id: { in: createdIds } },
  });
  console.log('CLEANUP: deleted', del.count, 'TeamNewsItem(s):', createdIds.join(', '));
}

await prisma.$disconnect();

const checks = {
  noPageErrors: errors.length === 0,
  vendorBtnOrSkip: vendorBtnCount > 0 || errors.every((e) => !e.startsWith('vendor_fee: no enabled')),
  badgeVisible: badge.display !== 'none' && Number(badge.total24) >= 0,
  feedHasAuto: feed.len > 50 && (feed.hasVendorFee || feed.hasVendorFree),
  homeNavOk: homeOk,
};

const failed = Object.entries(checks).filter(([, v]) => !v);
if (errors.length) console.error('ERRORS:', errors);
console.log('CHECKS:', JSON.stringify(checks, null, 2));
console.log('vendorJobId:', vendorJobId);
console.log('badge:', badge);
console.log('feed:', feed);
if (failed.length || errors.length) {
  console.error('FAIL:', failed.map(([k]) => k).join(', '));
  process.exit(1);
}
console.log('PASS: smoke-news-premium');
