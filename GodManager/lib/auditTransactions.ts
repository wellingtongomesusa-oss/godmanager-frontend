/**
 * Motor de auditoria (trust accounting / FREC) sobre o QuickBooks "Transaction List by Date".
 * SOMENTE LEITURA — recebe o texto do CSV e devolve os achados. Nao toca em banco nem em dados.
 * Regras: duplicidade, veiculo em conta errada, descasamento de caucao, invoices Voided/lacunas,
 * atraso de reconhecimento de receita. (Billback fica pendente ate definir contas "pessoais".)
 */

export type AuditFinding = {
  rule: string;
  date: string;
  name: string;
  account: string;
  amount: number;
  why: string;
  memo?: string;
};
export type AuditResult = {
  total: number;
  conformes: number;
  corrigir: AuditFinding[];
  ambiguos: AuditFinding[];
  invoices: { numbered: number; voided: number; gaps: number[]; voidedList: Array<{ date: string; num: string; name: string; amount: number }> };
};

function parseCsv(text: string): string[][] {
  const records: string[][] = []; let field = '', record: string[] = [], q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { record.push(field); field = ''; }
      else if (c === '\r') { /* ignora */ }
      else if (c === '\n') { record.push(field); records.push(record); field = ''; record = []; }
      else field += c;
    }
  }
  if (field.length || record.length) { record.push(field); records.push(record); }
  return records;
}
const numOf = (s: string) => { const n = Number(String(s || '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : 0; };

const VEHICLE = /\b(vehicle expense|auto expense|car tag|car tags|license plate|\bdmv\b|sunpass|e-?zpass|smog check|emission test|oil change|car wash|\bseguro carro\b|placa do carro)\b/i;
const AUTO_ACCT = /auto/i;
const TELECOM = /telephone|internet|t-?mobile|software|subscription/i;
const HOA_ACCT = /hoa/i;
const SECDEP = /security deposit|held security|escrow/i;
const FEE = /management (income|fee)|placement fee|leasing fee|lease renewal fee|4100|4150|4140/i;
const MONTHS_MAP: Record<string, number> = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };

export function auditTransactions(csvText: string): AuditResult {
  const records = parseCsv(csvText);
  type Row = { date: string; type: string; numRaw: string; name: string; memo: string; account: string; split: string; amount: number; debit: number; credit: number };
  const rows: Row[] = [];
  for (const f of records) {
    if (!f[0] || !/^\d{2}\/\d{2}\/\d{4}$/.test(String(f[0]).trim())) continue;
    rows.push({
      date: (f[0] || '').trim(), type: (f[1] || '').trim(), numRaw: (f[2] || '').trim(),
      name: (f[4] || '').trim(), memo: (f[5] || '').trim(), account: (f[6] || '').trim(), split: (f[7] || '').trim(),
      amount: numOf(f[8]), debit: numOf(f[9]), credit: numOf(f[10]),
    });
  }

  const corrigir: AuditFinding[] = [];
  const ambiguos: AuditFinding[] = [];

  // Duplicidade
  for (const r of rows) {
    if (/duplicate transfer|duplicate deposit|dup(licate)? sync/i.test(r.memo)) {
      corrigir.push({ rule: 'Depósito duplicado', date: r.date, name: r.name, account: r.account, amount: r.amount || r.debit || r.credit, why: 'memo indica duplicidade — exige estorno confirmado', memo: r.memo.slice(0, 90) });
    }
  }
  // Veiculo em conta errada
  for (const r of rows) {
    const blob = r.name + ' ' + r.memo + ' ' + r.split + ' ' + r.account;
    const inAuto = AUTO_ACCT.test(r.account) || AUTO_ACCT.test(r.split) || /vehicle expense/i.test(r.split);
    if (VEHICLE.test(blob) && !inAuto && !TELECOM.test(r.account + ' ' + r.split)) {
      const target = HOA_ACCT.test(r.account + ' ' + r.split) ? corrigir : ambiguos;
      target.push({ rule: 'Veículo em conta errada', date: r.date, name: r.name, account: r.account + (r.split ? ' / ' + r.split : ''), amount: r.amount, why: 'despesa de veículo fora de "Auto Expense"' + (HOA_ACCT.test(r.account + ' ' + r.split) ? ' (em HOA)' : ''), memo: r.memo.slice(0, 70) });
    }
  }
  // Reconhecimento de receita por competencia
  for (const r of rows) {
    if (!FEE.test(r.account + ' ' + r.split)) continue;
    const dm = r.date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (!dm) continue;
    const txn = new Date(Number(dm[3]), Number(dm[1]) - 1, Number(dm[2]));
    const mm = (r.memo + ' ' + r.name).toLowerCase().match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/);
    if (!mm) continue;
    let refYear = txn.getFullYear();
    const refMonth = MONTHS_MAP[mm[1]];
    if (refMonth > txn.getMonth()) refYear -= 1;
    const refEnd = new Date(refYear, refMonth + 1, 0);
    const days = Math.round((txn.getTime() - refEnd.getTime()) / 86400000);
    if (days > 30) ambiguos.push({ rule: 'Atraso de reconhecimento de receita', date: r.date, name: r.name, account: (r.account || r.split).slice(0, 40), amount: r.amount || r.debit || r.credit, why: `fee de ${mm[1]} lançado ${days} dias após o mês de competência` });
  }
  // Caucao — casar reembolsos com retencoes por nome
  const depByName = new Map<string, number>(), refByName = new Map<string, number>();
  for (const r of rows) {
    if (!SECDEP.test(r.account + ' ' + r.memo + ' ' + r.split)) continue;
    const key = r.name.toLowerCase().trim() || '(sem nome)';
    if (r.debit > 0 || /receipt|deposit|charge/i.test(r.type)) depByName.set(key, (depByName.get(key) || 0) + (r.debit || r.amount));
    if (r.credit > 0 || /refund|payment|check|expense/i.test(r.type)) refByName.set(key, (refByName.get(key) || 0) + (r.credit || Math.abs(r.amount)));
  }
  for (const [key, ref] of refByName) {
    const dep = depByName.get(key) || 0;
    if (Math.abs(ref - dep) > 0.01) ambiguos.push({ rule: 'Descasamento de caução', date: '', name: key, account: 'Security Deposit', amount: ref - dep, why: `reembolso ${ref.toFixed(2)} vs retido ${dep.toFixed(2)}` });
  }
  // Invoices — Voided + lacunas (so serie Invoice)
  const nums = rows.filter((r) => /^invoice$/i.test(r.type) && /^\d+$/.test(r.numRaw)).map((r) => parseInt(r.numRaw, 10));
  const voidedRows = rows.filter((r) => /void/i.test(r.type) || /void/i.test(r.memo));
  const gaps: number[] = [];
  if (nums.length) { const set = new Set(nums); const min = Math.min(...nums), max = Math.max(...nums); for (let n = min; n <= max; n++) if (!set.has(n)) gaps.push(n); }

  return {
    total: rows.length,
    conformes: rows.length - corrigir.length - ambiguos.length,
    corrigir, ambiguos,
    invoices: { numbered: nums.length, voided: voidedRows.length, gaps, voidedList: voidedRows.slice(0, 50).map((v) => ({ date: v.date, num: v.numRaw, name: v.name, amount: v.amount })) },
  };
}
