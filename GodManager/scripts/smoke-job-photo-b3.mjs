/**
 * Smoke B.3 — comentarios por container (Comment API) + News container_added + migracao lazy LS.
 * Limpa Comments + TeamNewsItem de teste no fim.
 */
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3101';
const EMAIL = (process.env.SMOKE_EMAIL || 'info@managerprop.com').toLowerCase();
const MIGRATE_TEXT = 'smoke-b3-migrate-' + Date.now();
const C1_TEXT = 'smoke-b3-c1-' + Date.now();
const C2_TEXT = 'smoke-b3-c2-' + Date.now();

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
    select: { id: true, role: true, status: true, clientId: true },
  });
  if (!user || user.status !== 'active') return null;
  let jobId = process.env.SMOKE_JOB_PHOTO_TEST_JOB || null;
  if (!jobId) {
    const any = await p.jobPhoto.findFirst({ select: { jobId: true } });
    jobId = any?.jobId || null;
  }
  if (!jobId) {
    const exp = await p.pmExpense.findFirst({ select: { id: true } });
    jobId = exp?.id || null;
  }
  return { user, jobId };
});

if (!setup?.user || !setup.jobId) {
  console.error('FAIL: setup (user/job)');
  process.exit(1);
}

const { user, jobId } = setup;
const createdCommentIds = [];
const createdNewsIds = [];
const errors = [];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.addInitScript(
  ({ userId, role, email, clientId }) => {
    window.__gmCurrentUser = { id: userId, role, email, status: 'active', clientId: clientId || null };
  },
  { userId: user.id, role: user.role, email: EMAIL, clientId: user.clientId },
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

await page.route('**/api/**', async (route) => {
  const url = route.request().url();
  if (
    /\/api\/(comments|news|jobs\/[^/]+\/photos)/.test(url)
  ) {
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
await page.waitForTimeout(800);

await page.evaluate(
  ({ jid, migrateText }) => {
    const extras = {};
    extras[jid] = { executor_comment: migrateText };
    localStorage.setItem('gm_job_expense_extras', JSON.stringify(extras));
    const mig = {};
    delete mig[jid];
    localStorage.setItem('gm_job_extras_migrated', JSON.stringify(mig));
  },
  { jid: jobId, migrateText: MIGRATE_TEXT },
);

await page.evaluate(async (jid) => {
  if (typeof gmJobOpenPhotoPopup === 'function') await gmJobOpenPhotoPopup(jid);
}, jobId);

await page.waitForTimeout(3500);

const afterMigrate = await page.evaluate(
  async ({ jid, migrateText }) => {
    const extras = JSON.parse(localStorage.getItem('gm_job_expense_extras') || '{}');
    const mig = JSON.parse(localStorage.getItem('gm_job_extras_migrated') || '{}');
    const r = await fetch(`/api/comments?entityType=JOB&entityId=${encodeURIComponent(jid)}`, {
      credentials: 'include',
    });
    const j = await r.json();
    const comments = j?.comments || [];
    const c1 = comments.filter(
      (c) => Number(c?.metadata?.containerNumber) === 1 && String(c.content || '').includes(migrateText),
    );
    return {
      lsCleared: !extras[jid]?.executor_comment,
      migratedFlag: !!mig[jid],
      c1Found: c1.length >= 1,
      c1Id: c1[0]?.id || null,
    };
  },
  { jid: jobId, migrateText: MIGRATE_TEXT },
);

if (afterMigrate.c1Id) createdCommentIds.push(afterMigrate.c1Id);

await page.evaluate(
  ({ c1Text, cn }) => {
    const ta = document.querySelector(`[data-jp-comment-ta][data-container="${cn}"]`);
    if (ta) ta.value = c1Text;
  },
  { c1Text: C1_TEXT, cn: 1 },
);

await page.click('[data-jp-comment-save][data-container="1"]');
await page.waitForTimeout(1500);

const afterC1Save = await page.evaluate(async (jid) => {
  const r = await fetch(`/api/comments?entityType=JOB&entityId=${encodeURIComponent(jid)}`, {
    credentials: 'include',
  });
  const j = await r.json();
  return (j?.comments || []).filter((c) => Number(c?.metadata?.containerNumber) === 1);
}, jobId);

afterC1Save.forEach((c) => {
  if (c.id && !createdCommentIds.includes(c.id)) createdCommentIds.push(c.id);
});

await page.click('#jp-btn-new-container');
await page.waitForTimeout(2000);

const newsCheck = await page.evaluate(async (jid) => {
  const r = await fetch('/api/news?limit=50', { credentials: 'include' });
  const j = await r.json();
  const items = j?.items || [];
  const hit = items.filter(
    (it) => it.subtype === 'container_added' && String(it.jobId) === String(jid),
  );
  return { count: hit.length, ids: hit.map((x) => x.id) };
}, jobId);

newsCheck.ids.forEach((id) => {
  if (id && !createdNewsIds.includes(id)) createdNewsIds.push(id);
});

await page.evaluate(
  ({ c2Text }) => {
    const ta = document.querySelector('[data-jp-comment-ta][data-container="2"]');
    if (ta) ta.value = c2Text;
  },
  { c2Text: C2_TEXT },
);

await page.click('[data-jp-comment-save][data-container="2"]');
await page.waitForTimeout(1500);

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

await page.evaluate(async (jid) => {
  if (typeof gmJobOpenPhotoPopup === 'function') await gmJobOpenPhotoPopup(jid);
}, jobId);
await page.waitForTimeout(3500);

const afterReload = await page.evaluate(
  ({ c1Text, c2Text }) => {
    const t1 = document.querySelector('[data-jp-comment-ta][data-container="1"]');
    const t2 = document.querySelector('[data-jp-comment-ta][data-container="2"]');
    const block2 = !!document.querySelector('[data-container="2"].jp-container-block, .jp-container-block[data-container="2"]');
    return {
      t1: t1?.value || '',
      t2: t2?.value || '',
      hasC1: (t1?.value || '').includes(c1Text) || (t1?.value || '').includes('smoke-b3-c1'),
      hasC2: (t2?.value || '').includes(c2Text),
      block2,
    };
  },
  { c1Text: C1_TEXT, c2Text: C2_TEXT },
);

const finalComments = await page.evaluate(async (jid) => {
  const r = await fetch(`/api/comments?entityType=JOB&entityId=${encodeURIComponent(jid)}`, {
    credentials: 'include',
  });
  const j = await r.json();
  return j?.comments || [];
}, jobId);

finalComments.forEach((c) => {
  const txt = String(c.content || '');
  if (
    txt.includes('smoke-b3') &&
    c.id &&
    !createdCommentIds.includes(c.id)
  ) {
    createdCommentIds.push(c.id);
  }
});

const commentCleanup = await page.evaluate(async (ids) => {
  const out = [];
  for (const id of ids) {
    const r = await fetch(`/api/comments/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const j = await r.json().catch(() => ({}));
    out.push({ id, ok: r.ok, j });
  }
  return out;
}, createdCommentIds);

await browser.close();

let newsRemaining = createdNewsIds.length;
if (createdNewsIds.length) {
  newsRemaining = await prismaOnce(async (p) => {
    await p.teamNewsItem.deleteMany({ where: { id: { in: createdNewsIds } } });
    return p.teamNewsItem.count({ where: { id: { in: createdNewsIds } } });
  });
}

let commentsRemaining = createdCommentIds.length;
if (createdCommentIds.length) {
  commentsRemaining = await prismaOnce(async (p) =>
    p.comment.count({
      where: { id: { in: createdCommentIds }, deletedAt: null },
    }),
  );
}

const checks = {
  migrateLsCleared: afterMigrate.lsCleared,
  migrateFlagSet: afterMigrate.migratedFlag,
  migrateCommentCreated: afterMigrate.c1Found,
  saveC1Api: afterC1Save.some((c) => String(c.content || '').includes(C1_TEXT)),
  newsContainerAdded: newsCheck.count >= 1,
  block2Visible: afterReload.block2,
  reloadHasC2: afterReload.hasC2,
  reloadHasC1OrMigrate: afterReload.hasC1 || afterMigrate.c1Found,
  commentsCleanup: commentsRemaining === 0,
  newsCleanup: newsRemaining === 0,
  noPageErrors: errors.length === 0,
};

console.log(
  JSON.stringify(
    {
      jobId,
      afterMigrate,
      afterC1Save: afterC1Save.length,
      newsCheck,
      afterReload,
      createdCommentIds,
      createdNewsIds,
      commentCleanup,
      checks,
      errors,
    },
    null,
    2,
  ),
);

const pass = Object.values(checks).every(Boolean);
process.exit(pass ? 0 : 1);
