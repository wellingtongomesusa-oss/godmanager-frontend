/**
 * Smoke B.2 — multi-container fotos (API + modal). Limpa uploads de teste no fim (API delete).
 */
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3101';
const EMAIL = (process.env.SMOKE_EMAIL || 'info@managerprop.com').toLowerCase();
const TINY_PNG = path.join(__dirname, '.smoke-tiny.png');
const PNG_B64 = fs.existsSync(TINY_PNG)
  ? fs.readFileSync(TINY_PNG).toString('base64')
  : 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

if (!fs.existsSync(TINY_PNG)) {
  fs.writeFileSync(TINY_PNG, Buffer.from(PNG_B64, 'base64'));
}

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

const setup = await prismaOnce(async (p) => {
  const user = await p.user.findFirst({
    where: { email: { equals: EMAIL, mode: 'insensitive' } },
    select: { id: true, role: true, status: true },
  });
  if (!user || user.status !== 'active') return null;
  const allPhotos = await p.jobPhoto.findMany({ select: { jobId: true } });
  const counts = {};
  allPhotos.forEach((row) => {
    counts[row.jobId] = (counts[row.jobId] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => a[1] - b[1]);
  let jobId = process.env.SMOKE_JOB_PHOTO_TEST_JOB || null;
  let initialCount = 0;
  if (jobId) {
    initialCount = counts[jobId] || 0;
  } else {
    for (const [jid, c] of sorted) {
      if (c < 18) {
        jobId = jid;
        initialCount = c;
        break;
      }
    }
  }
  if (!jobId) {
    const any = await p.jobPhoto.findFirst({ select: { jobId: true } });
    jobId = any?.jobId || null;
    if (jobId) initialCount = counts[jobId] || 0;
  }
  return { user, jobId, initialCount };
});

if (!setup?.user || !setup.jobId) {
  console.error('FAIL: setup (user/job)');
  process.exit(1);
}

const { user, jobId, initialCount } = setup;
const createdPhotoIds = [];
const errors = [];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.addInitScript(
  ({ userId, role, email }) => {
    window.__gmCurrentUser = {
      id: userId,
      role,
      email,
      status: 'active',
    };
  },
  { userId: user.id, role: user.role, email: EMAIL },
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
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

/** Evita dezenas de fetch no Premium.html que esgotam o pool Railway durante o smoke. */
await page.route('**/api/**', async (route) => {
  const url = route.request().url();
  if (/\/api\/jobs\/[^/]+\/photos/.test(url)) {
    await route.continue();
    return;
  }
  const method = route.request().method();
  if (method === 'GET' || method === 'HEAD') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, items: [], photos: [], data: [] }),
    });
    return;
  }
  await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
});

await page.goto(`${BASE}/GodManager_Premium.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1500);

const apiBefore = await page.evaluate(async (jid) => {
  const r = await fetch(`/api/jobs/${encodeURIComponent(jid)}/photos`, { credentials: 'include' });
  const txt = await r.text();
  let j = null;
  try {
    j = txt ? JSON.parse(txt) : null;
  } catch (e) {
    return { ok: false, status: r.status, parseError: String(e) };
  }
  return { ok: r.ok, status: r.status, j };
}, jobId);

const presigned = await page.evaluate(async (jid) => {
  const r = await fetch(`/api/jobs/${encodeURIComponent(jid)}/photos/presigned-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ contentType: 'image/png', sizeBytes: 68, containerNumber: 2 }),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ok: r.ok, j };
}, jobId);

const keyHasC2 = presigned.j?.key?.includes('/c2/') || false;

await page.evaluate(async (jid) => {
  if (typeof gmJobOpenPhotoPopup === 'function') await gmJobOpenPhotoPopup(jid);
}, jobId);
await page.waitForTimeout(1500);

const modal0 = await page.evaluate(() => ({
  host: !!document.getElementById('jp-containers-host'),
  block1: !!document.querySelector('[data-container="1"]'),
  btnNew: !!document.getElementById('jp-btn-new-container'),
}));

await page.waitForSelector('#jp-btn-new-container', { timeout: 30000 });
await page.click('#jp-btn-new-container');
await page.waitForTimeout(500);

const modal1 = await page.evaluate(() => ({
  blocks: document.querySelectorAll('.jp-container-block').length,
  block2: !!document.querySelector('[data-container="2"]'),
}));

const uploaded = await page.evaluate(
  async ({ jid, b64 }) => {
    try {
      const st = window.gmJobsPhotoState;
      if (!st || !st.jobId) return { ok: false, err: 'no state' };
      st.uploadContainer = 2;
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const file = new File([bytes], 'smoke-b2.png', { type: 'image/png' });
      const photo = await gmJobsPhotoUploadOne(jid, file, 2);
      st.photos = st.photos || [];
      st.photos.unshift(photo);
      if (!st.countsByJob) st.countsByJob = {};
      st.countsByJob[jid] = st.photos.length;
      gmJobsPhotoSyncContainersFromPhotos();
      gmJobsPhotoRenderGallery();
      gmJobsPhotoUpdateCounterEl();
      return { ok: true, photo };
    } catch (e) {
      return { ok: false, err: String(e.message || e) };
    }
  },
  { jid: jobId, b64: PNG_B64 },
);

if (uploaded.ok && uploaded.photo?.id) createdPhotoIds.push(uploaded.photo.id);

const afterUpload = await page.evaluate(async (jid) => {
  const r = await fetch(`/api/jobs/${encodeURIComponent(jid)}/photos`, { credentials: 'include' });
  const txt = await r.text();
  let j = null;
  try {
    j = txt ? JSON.parse(txt) : null;
  } catch (e) {
    return { total: 0, c2count: 0, c2ids: [], imgs2: 0, parseError: String(e), status: r.status };
  }
  const c2 = (j?.photos || []).filter((p) => Number(p.containerNumber) === 2);
  return {
    total: j.photos?.length || 0,
    c2count: c2.length,
    c2ids: c2.map((p) => p.id),
    imgs2: document.querySelector('[data-container="2"]')?.querySelectorAll('img').length || 0,
    uploadErr: null,
  };
}, jobId);

for (const id of afterUpload.c2ids) {
  if (!createdPhotoIds.includes(id)) createdPhotoIds.push(id);
}

for (let i = 0; i < 6; i++) {
  const canClick = await page.evaluate(() => {
    const b = document.getElementById('jp-btn-new-container');
    return b && !b.disabled;
  });
  if (!canClick) break;
  await page.click('#jp-btn-new-container');
  await page.waitForTimeout(150);
}

const blocksMax = await page.evaluate(() => ({
  blocks: document.querySelectorAll('.jp-container-block').length,
  btnDisabled: document.getElementById('jp-btn-new-container')?.disabled,
}));

const limit20 = await page.evaluate(() => {
  const st = window.gmJobsPhotoState;
  if (!st) return { ok: false, err: 'no state' };
  const saved = st.photos.slice();
  const savedMc = st.maxContainer;
  st.photos = Array.from({ length: 20 }, (_, i) => ({
    id: 'mock-' + i,
    containerNumber: 1,
    publicUrl: '',
    filename: '',
    contentType: '',
    uploadedAt: '',
  }));
  st.maxContainer = 2;
  gmJobsPhotoUpdateNewContainerButton();
  gmJobsPhotoUpdateUploadButtonsDisabled();
  const btn = document.getElementById('jp-btn-new-container');
  const tip = btn?.title || '';
  const uploadBtns = Array.from(document.querySelectorAll('[data-jp-upload-btn]')).every((b) => b.disabled);
  st.photos = saved;
  st.maxContainer = savedMc;
  gmJobsPhotoUpdateNewContainerButton();
  gmJobsPhotoUpdateUploadButtonsDisabled();
  return {
    ok: btn?.disabled === true && /20/.test(tip) && uploadBtns,
    tip,
    btnDisabled: btn?.disabled,
    uploadBtns,
  };
});

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.evaluate(async (jid) => {
  if (typeof gmJobOpenPhotoPopup === 'function') await gmJobOpenPhotoPopup(jid);
}, jobId);
await page.waitForTimeout(1500);
const afterReload = await page.evaluate(() => ({
  imgs2: document.querySelector('[data-container="2"]')?.querySelectorAll('img').length || 0,
}));

const cleanup = await page.evaluate(
  async ({ jid, ids }) => {
    const out = [];
    for (const photoId of ids) {
      const r = await fetch(`/api/jobs/${encodeURIComponent(jid)}/photos/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ photoId }),
      });
      out.push({ photoId, ok: r.ok, status: r.status });
    }
    return out;
  },
  { jid: jobId, ids: createdPhotoIds },
);

await browser.close();

let remainingC2 = createdPhotoIds.length;
if (createdPhotoIds.length) {
  remainingC2 = await prismaOnce((p) =>
    p.jobPhoto.count({ where: { id: { in: createdPhotoIds } } }),
  );
}

const checks = {
  apiListOk: apiBefore.ok,
  apiHasContainerField: (apiBefore.j?.photos || []).every(
    (p) => p.containerNumber === undefined || Number(p.containerNumber) >= 1,
  ),
  presignedOk: presigned.ok && keyHasC2,
  modalHost: modal0.host,
  container1Present: modal0.block1,
  newContainerBtn: modal0.btnNew,
  addContainerWorks: modal1.blocks >= 2 && modal1.block2,
  uploadFnOk: uploaded.ok,
  uploadC2Api: afterUpload.c2count >= 1,
  uploadC2Ui: afterUpload.imgs2 >= 1 || afterReload.imgs2 >= 1,
  maxFiveContainers: blocksMax.blocks <= 5 && blocksMax.btnDisabled === true,
  limit20PhotosBlocksNew: limit20.ok,
  reloadKeepsC2: afterReload.imgs2 >= 1,
  cleanupDone: remainingC2 === 0,
  noPageErrors: errors.length === 0,
};

console.log(
  JSON.stringify(
    {
      jobId,
      initialCount,
      presignedKey: presigned.j?.key,
      uploaded,
      createdPhotoIds,
      afterUpload,
      blocksMax,
      limit20,
      cleanup,
      checks,
      errors,
    },
    null,
    2,
  ),
);

const pass = Object.values(checks).every(Boolean);
process.exit(pass ? 0 : 1);
