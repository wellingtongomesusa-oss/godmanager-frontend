/**
 * Smoke — Jobs Follow (read-only tabela grid alinhada + bolas por coluna).
 * C1: vendor_requested — colunas alinhadas, header único, current dourada
 * C2: closed_internal — skip tracejado nas colunas vendor, closed current
 * C3: read-only, filtros, Jobs page intacta
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3101';
const __dir = dirname(fileURLToPath(import.meta.url));
const users = JSON.parse(readFileSync(join(__dir, '.smoke-vendor-free-users.json'), 'utf8'));

function sessionCookieValue(userId, role) {
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  return Buffer.from(JSON.stringify({ userId, role, exp })).toString('base64');
}

async function runAsUser(user, fn) {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
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
  const errors = [];
  page.on('pageerror', (e) => errors.push(`${user.email}: ${e.message}`));
  page.setDefaultTimeout(120000);
  let patchCount = 0;
  await page.route('**/api/pm/expenses/**', async (route) => {
    if (route.request().method() === 'PATCH') patchCount += 1;
    await route.continue();
  });
  try {
    await page.goto(`${BASE}/GodManager_Premium.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => typeof nav === 'function', { timeout: 60000 });
    return { ...(await fn(page)), errors, patchCount };
  } finally {
    await browser.close();
  }
}

async function followReady(page) {
  await page.evaluate(async () => {
    if (typeof gmJobsSetDateFilter === 'function') gmJobsSetDateFilter('all');
    if (typeof gmJobsSetPropertyFilter === 'function') gmJobsSetPropertyFilter('');
    if (typeof gmJobsSetVendorFilter === 'function') gmJobsSetVendorFilter('');
    nav('jobs-follow');
  });
  await page.waitForTimeout(2500);
  await page.evaluate(async () => {
    window.__jobsExpensesCacheAt = 0;
    if (typeof jobsInvalidateApiCache === 'function') jobsInvalidateApiCache();
    try {
      if (typeof jobsFetchFromApi === 'function') await jobsFetchFromApi();
    } catch (_e) {
      /* API local 500 — smoke usa mock */
    }
    if (typeof gmJobsFollowInit === 'function') await gmJobsFollowInit();
  });
  await page.waitForTimeout(2000);
}

function injectMocks(page) {
  return page.evaluate(() => {
    const mocks = [
      {
        id: 'smoke-follow-vreq',
        vendorId: 'v-smoke-1',
        vendorName: 'ACME Plumbing Co',
        propertyCode: 'P0099',
        propAddress: '123 Smoke Test St, Orlando FL',
        status: 'SCHEDULED',
        ownerCharged: 150,
        serviceDate: '2024-01-15',
        metadata: { followUp: { stage: 'vendor_requested' }, houseLabel: '123 Smoke Test St' },
      },
      {
        id: 'smoke-follow-internal',
        propertyCode: 'P0102',
        propAddress: '222 Internal Path Way',
        status: 'SCHEDULED',
        isVendorFree: true,
        ownerCharged: 90,
        serviceDate: '2025-01-10',
        metadata: { followUp: { stage: 'closed_internal' }, houseLabel: '222 Internal Path Way' },
      },
      {
        id: 'smoke-follow-final',
        vendorId: 'v-smoke-2',
        vendorName: 'Beta HVAC LLC',
        propertyCode: 'P0100',
        propAddress: '456 Finalized Ave, Kissimmee FL',
        status: 'FINALIZED',
        ownerCharged: 220,
        serviceDate: '2025-06-01',
        metadata: { houseLabel: '456 Finalized Ave' },
      },
    ];
    if (typeof ltExpMapApiToRow !== 'function') return { ok: false, reason: 'ltExpMapApiToRow missing' };
    const mapped = mocks.map((e) => ltExpMapApiToRow(e));
    window.__jobsApiRowsCache = mapped;
    window.__jobsExpensesCacheAt = Date.now();
    const origFetch = window.jobsFetchFromApi;
    window.jobsFetchFromApi = async function () {
      window.__jobsApiRowsCache = mapped;
      return mapped;
    };
    const done = () => {
      if (typeof gmJobsFollowRender === 'function') gmJobsFollowRender();
      window.jobsFetchFromApi = origFetch;
      return { ok: true, count: mapped.length };
    };
    if (typeof gmJobsFollowPopulateFilters === 'function') {
      return gmJobsFollowPopulateFilters().then(done);
    }
    return done();
  });
}

/** Snapshot da tabela #jobs-follow-cards (grid único). */
const DOM_TABLE_SNAPSHOT_JS = `function(){
 var host=document.getElementById('jobs-follow-cards');
 if(!host)return{ok:false,reason:'no host'};
 var hostStyle=window.getComputedStyle(host);
 var rows=[].slice.call(host.querySelectorAll('.gm-jf-row[data-job-id]'));
 var thead=host.querySelector('.gm-jf-thead');
 var hdrStages=thead?[].slice.call(thead.querySelectorAll('.gm-jf-th-stage')):[];
 var hdrLabels=hdrStages.map(function(el){return String(el.textContent||'').trim();});
 function centerX(el){
  var r=el.getBoundingClientRect();
  return r.left+r.width/2;
 }
 function colAligned(stageKey){
  var hdr=host.querySelector('.gm-jf-th-stage[data-col-stage="'+stageKey+'"]');
  if(!hdr)return{ok:false,reason:'no header '+stageKey};
  var hx=centerX(hdr);
  var cells=rows.map(function(row){
   return row.querySelector('.gm-jf-td-stage[data-stage="'+stageKey+'"] .gm-jf-ball');
  }).filter(Boolean);
  if(cells.length<3)return{ok:false,reason:'need 3 rows',count:cells.length};
  var xs=cells.map(function(b){return centerX(b);});
  var allNearHdr=xs.every(function(x){return Math.abs(x-hx)<=2;});
  var spread=Math.max.apply(null,xs)-Math.min.apply(null,xs);
  return{ok:allNearHdr&&spread<=2,hx:hx,xs:xs,spread:spread,stage:stageKey};
 }
 var colsAligned={
  vendor:colAligned('vendor_requested'),
  closed:colAligned('followup_closed')
 };
 var headerOnce={
  theadCount:host.querySelectorAll('.gm-jf-thead').length,
  hdrStageCount:hdrStages.length,
  hdrLabels:hdrLabels,
  rowStageLabels:rows.reduce(function(n,row){
   return n+row.querySelectorAll('.gm-jf-th-stage,.gm-jf-cap').length;
  },0)
 };
 function isGoldRgb(bg){
  var m=String(bg||'').match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
  if(!m)return false;
  return parseInt(m[1],10)===201&&parseInt(m[2],10)===169&&parseInt(m[3],10)===110;
 }
 var allBalls=[].slice.call(host.querySelectorAll('.gm-jf-ball'));
 var ballPaint={ok:false,balls:[],currentOk:false,currentBg:null};
 if(allBalls.length){
  ballPaint.balls=allBalls.map(function(b){
   var cs=window.getComputedStyle(b);
   var br=parseFloat(cs.borderRadius)||0;
   var w=parseFloat(cs.width)||0;
   var h=parseFloat(cs.height)||0;
   var bg=cs.backgroundColor;
   var bw=parseFloat(cs.borderTopWidth)||parseFloat(cs.borderWidth)||0;
   var bs=cs.boxShadow;
   var bst=cs.borderTopStyle||cs.borderStyle||'';
   var transparent=bg==='transparent'||bg==='rgba(0, 0, 0, 0)';
   var painted=!transparent||bw>=2;
   var circle=br>=9||(w>0&&br>=w/2-1);
   var isCur=b.classList.contains('is-current');
   var isSkip=b.classList.contains('is-skip');
   return{borderRadius:cs.borderRadius,width:cs.width,height:cs.height,backgroundColor:bg,borderWidth:cs.borderWidth,borderStyle:bst,boxShadow:bs,painted:!!painted,circle:!!circle,isCurrent:isCur,isSkip:isSkip,text:String(b.textContent||'').trim()};
  });
  var nonSkip=ballPaint.balls.filter(function(bp){return !bp.isSkip;});
  ballPaint.ok=nonSkip.length>0&&nonSkip.every(function(bp){
   return bp.circle&&Math.abs(parseFloat(bp.width)-18)<=2&&Math.abs(parseFloat(bp.height)-18)<=2&&bp.painted;
  });
  var curBp=ballPaint.balls.find(function(bp){return bp.isCurrent;});
  ballPaint.currentOk=!!curBp&&curBp.painted&&curBp.circle&&curBp.boxShadow&&curBp.boxShadow!=='none'&&isGoldRgb(curBp.backgroundColor);
  ballPaint.currentBg=curBp?curBp.backgroundColor:null;
 }
 var internalRow=host.querySelector('.gm-jf-row[data-job-id="smoke-follow-internal"]');
 var skipOk=false;
 if(internalRow){
  var skipCols=['vendor_requested','awaiting_quote','awaiting_vendor','vendor_done'];
  skipOk=skipCols.every(function(st){
   var ball=internalRow.querySelector('.gm-jf-td-stage[data-stage="'+st+'"] .gm-jf-ball');
   if(!ball||!ball.classList.contains('is-skip'))return false;
   var cs=window.getComputedStyle(ball);
   var dashed=String(cs.borderTopStyle||cs.borderStyle||'').indexOf('dashed')>=0;
   return dashed&&String(ball.textContent||'').trim()==='';
  });
 }
 var baseCols={ok:false};
 if(rows.length>=2){
  var fields=['.gm-jf-td-addr','.gm-jf-td-badge','.gm-jf-td-date','.gm-jf-td-value','.gm-jf-td-status'];
  var aligned=fields.every(function(sel){
   var rects=rows.map(function(row){var el=row.querySelector(sel);return el?el.getBoundingClientRect():null;}).filter(Boolean);
   if(rects.length<2)return false;
   var xs=rects.map(function(r){return r.left+r.width/2;});
   var spread=Math.max.apply(null,xs)-Math.min.apply(null,xs);
   return spread<=3;
  });
  baseCols={ok:aligned,rowCount:rows.length};
 }
 var vreqRow=host.querySelector('.gm-jf-row[data-job-id="smoke-follow-vreq"]');
 var vreqCurrent=vreqRow?vreqRow.querySelector('.gm-jf-td-stage[data-ball-state="current"]'):null;
 var vreqStage=vreqRow?vreqRow.getAttribute('data-follow-stage'):null;
 var internalCurrent=internalRow?internalRow.querySelector('.gm-jf-td-stage[data-ball-state="current"]'):null;
 var internalStage=internalRow?internalRow.getAttribute('data-follow-stage'):null;
 return{
  ok:true,
  gridDisplay:hostStyle.display,
  rowCount:rows.length,
  colsAligned:colsAligned,
  headerOnce:headerOnce,
  ballPaint:ballPaint,
  skipOk:skipOk,
  baseCols:baseCols,
  vreqStage:vreqStage,
  vreqCurrentStage:vreqCurrent?vreqCurrent.getAttribute('data-stage'):null,
  internalStage:internalStage,
  internalCurrentStage:internalCurrent?internalCurrent.getAttribute('data-stage'):null
 };
}`;

async function smokeAdmin() {
  return runAsUser(users.admin, async (page) => {
    await followReady(page);
    await injectMocks(page);
    await page.waitForTimeout(800);

    const table = await page.evaluate((snapSrc) => {
      const snap = new Function('return ' + snapSrc)();
      const snapResult = snap();
      snapResult.pageActive = !!(
        document.getElementById('page-jobs-follow') &&
        document.getElementById('page-jobs-follow').classList.contains('active')
      );
      return snapResult;
    }, DOM_TABLE_SNAPSHOT_JS);

    const c2filters = await page.evaluate(async () => {
      if (typeof gmJobsFollowSetDateFilter === 'function') gmJobsFollowSetDateFilter('all');
      const oldDateVisible = !!document.querySelector('[data-job-id="smoke-follow-vreq"]');
      if (typeof gmJobsSetPropertyFilter === 'function') gmJobsSetPropertyFilter('P0099');
      if (typeof gmJobsFollowRender === 'function') gmJobsFollowRender();
      const afterProp = [...document.querySelectorAll('.gm-jf-row[data-job-id]')].map((c) =>
        c.getAttribute('data-job-id'),
      );
      if (typeof gmJobsSetPropertyFilter === 'function') gmJobsSetPropertyFilter('');
      if (typeof gmJobsSetVendorFilter === 'function') gmJobsSetVendorFilter('ACME Plumbing Co');
      if (typeof gmJobsFollowRender === 'function') gmJobsFollowRender();
      const afterVendor = [...document.querySelectorAll('.gm-jf-row[data-job-id]')].map((c) =>
        c.getAttribute('data-job-id'),
      );
      if (typeof gmJobsSetVendorFilter === 'function') gmJobsSetVendorFilter('');
      if (typeof gmJobsFollowRender === 'function') gmJobsFollowRender();
      return {
        dateFilter: window.__jobsDateFilter,
        oldDateVisible,
        propFilterOk: afterProp.length === 1 && afterProp[0] === 'smoke-follow-vreq',
        vendorFilterOk: afterVendor.length === 1 && afterVendor[0] === 'smoke-follow-vreq',
      };
    });

    const c2path = await page.evaluate(() => {
      const row = (window.__jobsApiRowsCache || []).find((r) => r.id === 'smoke-follow-internal');
      const path =
        row && typeof gmJobsFollowStepperPath === 'function' ? gmJobsFollowStepperPath(row) : [];
      const stage =
        row && typeof gmJobFollowUpDisplayStage === 'function'
          ? gmJobFollowUpDisplayStage(row)
          : null;
      return { path, stage };
    });

    const c3 = await page.evaluate(() => {
      const followPatchBtn = !!document.querySelector(
        '#page-jobs-follow [onclick*="gmJobFollowUpPatch"],#page-jobs-follow [onclick*="followUpPatch"]',
      );
      nav('jobs');
      const jobsTable = !!document.getElementById('jobs-table');
      const jobsSubtitleLen = (document.getElementById('jobs-page-subtitle') || {}).textContent.length;
      return { followPatchBtn, jobsTable, jobsSubtitleLen };
    });

    const hdrExpected = ['Open', 'Maint', 'Vendor', 'Quote', 'Wait', 'Done', 'Closed'];

    const ok =
      table.pageActive &&
      table.ok &&
      table.gridDisplay === 'grid' &&
      table.rowCount >= 3 &&
      table.colsAligned?.vendor?.ok &&
      table.colsAligned?.closed?.ok &&
      table.headerOnce?.theadCount === 1 &&
      table.headerOnce?.hdrStageCount === 7 &&
      hdrExpected.every((l, i) => table.headerOnce?.hdrLabels?.[i] === l) &&
      table.headerOnce?.rowStageLabels === 0 &&
      table.ballPaint?.ok &&
      table.ballPaint?.currentOk &&
      table.skipOk &&
      table.baseCols?.ok &&
      table.vreqStage === 'vendor_requested' &&
      table.vreqCurrentStage === 'vendor_requested' &&
      table.internalStage === 'closed_internal' &&
      table.internalCurrentStage === 'followup_closed' &&
      c2path.path.includes('closed_internal') &&
      !c2path.path.includes('vendor_requested') &&
      c2filters.dateFilter === 'all' &&
      c2filters.propFilterOk &&
      c2filters.vendorFilterOk &&
      c3.jobsTable &&
      !c3.followPatchBtn;

    return { ok, role: 'admin', table, c2path, c2filters, c3 };
  });
}

async function smokeMaintenance() {
  return runAsUser(users.maint, async (page) => {
    await page.waitForFunction(() => typeof jobsApplyRoleGateV2 === 'function', { timeout: 60000 });
    await page.waitForTimeout(4000);
    const gate = await page.evaluate(async () => {
      if (typeof gmAuthHydrateUserBadge === 'function') await gmAuthHydrateUserBadge();
      if (typeof jobsApplyRoleGateV2 === 'function') await jobsApplyRoleGateV2();
      if (typeof gmApplyJobsOnlySidebarMode === 'function') gmApplyJobsOnlySidebarMode();
      const el = document.getElementById('nav-jobs-follow');
      const jobsOnly = document.getElementById('nav-jobs');
      return {
        navFollowHidden: !el || el.style.display === 'none' || el.offsetParent === null,
        navJobsVisible: !!(jobsOnly && jobsOnly.offsetParent !== null),
      };
    });
    return { ok: gate.navFollowHidden && gate.navJobsVisible, role: 'maintenance', gate };
  });
}

const adminRun = await smokeAdmin();
await new Promise((r) => setTimeout(r, 4000));
const maintRun = await smokeMaintenance();

const summary = {
  pass:
    adminRun.ok &&
    maintRun.ok &&
    adminRun.patchCount === 0 &&
    (adminRun.errors?.length || 0) === 0 &&
    (maintRun.errors?.length || 0) === 0,
  admin: adminRun,
  maintenance: maintRun,
};

console.log(JSON.stringify(summary, null, 2));
process.exit(summary.pass ? 0 : 1);
