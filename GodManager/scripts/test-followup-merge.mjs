/**
 * Unit tests — mergeFollowUpMetadata (sem server/DB).
 * Uso: npx tsx scripts/test-followup-merge.mjs
 */
const jobFollowUp = await import('../lib/jobFollowUp.ts');
const { mergeFollowUpMetadata, getFollowUpStage } = jobFollowUp;

const AT1 = '2026-05-20T12:00:00.000Z';
const AT2 = '2026-05-21T10:00:00.000Z';
const BY = 'admin@test.com';

const results = { t1: false, t2: false, t3: false, t4: false };

try {
  const existing = {
    reschedules: [{ date: '2026-05-01', atIso: '2026-05-01T08:00:00.000Z', by: 'vendor' }],
    openedBy: 'jair@jair.com',
    fromJobId: 'job-orig-1',
    isVendorFree: true,
  };
  const t1 = mergeFollowUpMetadata(
    existing,
    { stage: 'vendor_requested', note: 'smoke' },
    { by: BY, at: AT1 },
  );
  results.t1 =
    JSON.stringify(t1.reschedules) === JSON.stringify(existing.reschedules) &&
    t1.openedBy === 'jair@jair.com' &&
    t1.fromJobId === 'job-orig-1' &&
    t1.isVendorFree === true &&
    t1.followUp?.stage === 'vendor_requested' &&
    t1.followUp?.stageBy === BY &&
    t1.followUp?.history?.length === 1;
} catch (e) {
  results.t1 = false;
  results.t1Error = e.message;
}

try {
  const t2a = mergeFollowUpMetadata({}, { stage: 'opened', note: 'first' }, { by: BY, at: AT1 });
  const t2b = mergeFollowUpMetadata(
    t2a,
    { stage: 'awaiting_quote', note: 'second' },
    { by: 'lucas@test.com', at: AT2 },
  );
  const hist = t2b.followUp?.history || [];
  results.t2 =
    hist.length === 2 &&
    hist[0]?.stage === 'opened' &&
    hist[0]?.by === BY &&
    hist[1]?.stage === 'awaiting_quote' &&
    hist[1]?.by === 'lucas@test.com' &&
    hist[1]?.note === 'second';
} catch (e) {
  results.t2 = false;
  results.t2Error = e.message;
}

try {
  let rejected = false;
  try {
    mergeFollowUpMetadata({}, { stage: 'not_a_real_stage' }, { by: BY, at: AT1 });
  } catch (e) {
    rejected =
      (jobFollowUp.FollowUpMergeError && e instanceof jobFollowUp.FollowUpMergeError) ||
      e?.name === 'FollowUpMergeError';
  }
  results.t3 = rejected;
} catch (e) {
  results.t3 = false;
  results.t3Error = e.message;
}

try {
  const t4base = mergeFollowUpMetadata(
    {},
    {
      stage: 'awaiting_vendor',
      assignees: ['samuel@test.com'],
      vendorQuote: { amount: 250, photoIds: ['p0'] },
      autoRollover: { count: 1 },
    },
    { by: BY, at: AT1 },
  );
  const t4 = mergeFollowUpMetadata(
    t4base,
    {
      assignees: ['henrique@test.com'],
      vendorQuote: { photoIds: ['p1'], receivedAt: AT2 },
      autoRollover: { lastAt: AT2 },
    },
    { by: BY, at: AT2 },
  );
  const fu = t4.followUp;
  results.t4 =
    fu?.stage === 'awaiting_vendor' &&
    fu?.history?.length === 1 &&
    Array.isArray(fu?.assignees) &&
    fu.assignees.includes('samuel@test.com') &&
    fu.assignees.includes('henrique@test.com') &&
    fu?.vendorQuote?.amount === 250 &&
    fu?.vendorQuote?.photoIds?.includes('p0') &&
    fu?.vendorQuote?.photoIds?.includes('p1') &&
    fu?.vendorQuote?.receivedAt === AT2 &&
    fu?.autoRollover?.count === 1 &&
    fu?.autoRollover?.lastAt === AT2;
} catch (e) {
  results.t4 = false;
  results.t4Error = e.message;
}

const pass = results.t1 && results.t2 && results.t3 && results.t4;
const count = [results.t1, results.t2, results.t3, results.t4].filter(Boolean).length;

console.log(
  JSON.stringify(
    {
      pass,
      score: `${count}/4`,
      results,
      defaultStage: getFollowUpStage({}),
    },
    null,
    2,
  ),
);

process.exit(pass ? 0 : 1);
