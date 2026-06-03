/**
 * Smoke B.1 — JobPhoto.containerNumber schema only (API + modal regressao).
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

const photoRow = await prisma.jobPhoto.findFirst({
  orderBy: { uploadedAt: 'desc' },
  select: { jobId: true, containerNumber: true, id: true },
});
if (!photoRow) {
  console.error('FAIL: no job photos in DB for smoke');
  await prisma.$disconnect();
  process.exit(1);
}
if (photoRow.containerNumber !== 1) {
  console.error('FAIL: expected containerNumber=1 on sample', photoRow);
  await prisma.$disconnect();
  process.exit(1);
}

const total = await prisma.jobPhoto.count();
const allOne = await prisma.jobPhoto.count({ where: { containerNumber: 1 } });
await prisma.$disconnect();

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
page.setDefaultTimeout(90000);
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(`${BASE}/GodManager_Premium.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });

const apiRes = await page.evaluate(async (jobId) => {
  const r = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/photos`, { credentials: 'include' });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ok: r.ok, j };
}, photoRow.jobId);

const expectedKeys = ['id', 'publicUrl', 'filename', 'contentType', 'sizeBytes', 'uploadedAt', 'uploadedBy'];
const first = apiRes.j?.photos?.[0];
const keysOk = first
  ? expectedKeys.every((k) => Object.prototype.hasOwnProperty.call(first, k))
  : false;
const noContainerInApi = first ? !('containerNumber' in first) : true;
await page.waitForFunction(() => typeof gmJobOpenPhotoPopup === 'function', { timeout: 60000 });

const modal = await page.evaluate(async (jobId) => {
  await gmJobOpenPhotoPopup(jobId);
  await new Promise((r) => setTimeout(r, 1200));
  const m = document.getElementById('modal-job-photos');
  const title = m?.querySelector('h3,h2,[class*="title"]')?.textContent || m?.textContent?.slice(0, 80) || '';
  const imgs = m ? m.querySelectorAll('img').length : 0;
  const visible = m && getComputedStyle(m).display !== 'none';
  return { visible: !!visible, imgs, titleSnippet: String(title).slice(0, 60) };
}, photoRow.jobId);

await browser.close();

const checks = {
  dbAllContainerOne: total > 0 && allOne === total,
  apiOk: apiRes.ok && apiRes.status === 200,
  apiHasPhotos: (apiRes.j?.photos?.length || 0) > 0,
  apiShapeUnchanged: keysOk && noContainerInApi,
  apiCountField: typeof apiRes.j?.count === 'number',
  modalOpens: modal.visible,
  modalShowsImages: modal.imgs > 0,
  noPageErrors: errors.length === 0,
};

console.log(
  JSON.stringify(
    {
      jobId: photoRow.jobId,
      db: { total, allOne },
      api: { status: apiRes.status, count: apiRes.j?.count, firstKeys: first ? Object.keys(first) : [] },
      modal,
      checks,
      errors,
    },
    null,
    2,
  ),
);

const pass = Object.values(checks).every(Boolean);
process.exit(pass ? 0 : 1);
