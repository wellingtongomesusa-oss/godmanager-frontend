import { serviceDateToMonthRef } from '../lib/pmCycleRef';

const cases = [
  { date: '2026-03-14', expected: '2026-02' },
  { date: '2026-03-15', expected: '2026-03' },
  { date: '2026-04-14', expected: '2026-03' },
  { date: '2026-04-15', expected: '2026-04' },
  { date: '2026-04-30', expected: '2026-04' },
  { date: '2026-05-14', expected: '2026-04' },
  { date: '2026-05-15', expected: '2026-05' },
  { date: '2026-12-15', expected: '2026-12' },
  { date: '2027-01-14', expected: '2026-12' },
  { date: '2027-01-15', expected: '2027-01' },
];

let pass = 0,
  fail = 0;
for (const c of cases) {
  const got = serviceDateToMonthRef(c.date);
  const ok = got === c.expected;
  console.log(ok ? '✓' : '✗', c.date, '->', got, '(expected', c.expected + ')');
  if (ok) pass++;
  else fail++;
}
console.log('\nResults:', pass, 'pass,', fail, 'fail');
process.exit(fail > 0 ? 1 : 0);
