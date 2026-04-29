import { computePropertyStatus } from '@/lib/propertyStatus';

const cases = [
  { in: { tenant: '', rent: 0, deposit: 0, mgmpct: 0 }, out: 'WTC' },
  { in: { tenant: '', rent: 0, deposit: 500, mgmpct: 8 }, out: 'VG' },
  { in: { tenant: '', rent: 0, deposit: 0, mgmpct: 10 }, out: 'ADM' },
  { in: { tenant: 'John', rent: 1500, deposit: 1500, mgmpct: 10 }, out: 'ADM' },
  { in: { tenant: 'John', rent: 1500, deposit: 1500, mgmpct: 8 }, out: 'ALG' },
  { in: { tenant: '', rent: 1500, deposit: 0, mgmpct: 8 }, out: 'INT' },
  { in: { tenant: '   ', rent: 1500, deposit: 0, mgmpct: 8 }, out: 'INT' },
  { in: { tenant: '', rent: 0, deposit: 1000, mgmpct: 8 }, out: 'VG' },
];

let pass = 0,
  fail = 0;
for (const c of cases) {
  const got = computePropertyStatus(c.in);
  const ok = got === c.out;
  console.log(`${ok ? '✅' : '❌'} input=${JSON.stringify(c.in)} expected=${c.out} got=${got}`);
  ok ? pass++ : fail++;
}
console.log(`\nPASS: ${pass} | FAIL: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
