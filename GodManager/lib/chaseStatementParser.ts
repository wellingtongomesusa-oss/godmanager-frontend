/**
 * Parser dos extratos Chase (Platinum Business Checking) — statement consolidado com múltiplas contas.
 * Entrada: TEXTO já extraído do PDF (ex.: `pdftotext -layout`). SOMENTE LEITURA/parse — não toca banco.
 *
 * O extrato traz âncoras internas (*start*deposits and additions, *start*summary, *start*globalproduct…)
 * que delimitam contas e seções, e um "Consolidated Balance Summary" com saldo inicial/final de cada conta.
 * Validação: saldo inicial + créditos − débitos == saldo final (por conta).
 */

export type ChaseTxn = {
  date: string; // 'YYYY-MM-DD'
  description: string;
  amount: number; // crédito > 0, débito < 0
  section: 'DEPOSIT' | 'ATM_DEBIT' | 'ELECTRONIC' | 'FEE';
};

export type ChaseAccount = {
  accountNumber: string;
  last4: string;
  beginningBalance: number;
  endingBalance: number;
  totalCredits: number;
  totalDebits: number; // valor positivo (soma das saídas)
  transactions: ChaseTxn[];
  computedEnding: number; // beginning + credits - debits
  balanced: boolean; // computedEnding ≈ endingBalance
  diff: number;
};

export type ChaseStatement = {
  periodStart: string | null; // 'YYYY-MM-DD'
  periodEnd: string | null;
  periodMonth: string | null; // 'YYYY-MM' (mês do fim do período)
  accounts: ChaseAccount[];
};

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function parseMoney(raw: string): number {
  const neg = /-/.test(raw);
  const n = Number(raw.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n)) return 0;
  return neg ? -n : n;
}

const MONEY_RE = /-?\$?[\d,]+\.\d{2}/g;

function parsePeriod(text: string): { start: string | null; end: string | null; month: string | null } {
  const m = text.match(/([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\s+through\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/);
  if (!m) return { start: null, end: null, month: null };
  const mm1 = MONTHS[m[1].toLowerCase()];
  const mm2 = MONTHS[m[4].toLowerCase()];
  if (!mm1 || !mm2) return { start: null, end: null, month: null };
  const start = `${m[3]}-${String(mm1).padStart(2, '0')}-${String(Number(m[2])).padStart(2, '0')}`;
  const end = `${m[6]}-${String(mm2).padStart(2, '0')}-${String(Number(m[5])).padStart(2, '0')}`;
  return { start, end, month: `${m[6]}-${String(mm2).padStart(2, '0')}` };
}

/** Lê o Consolidated Balance Summary: [{ accountNumber, beginning, ending }]. */
function parseConsolidated(text: string): Array<{ accountNumber: string; beginning: number; ending: number }> {
  const out: Array<{ accountNumber: string; beginning: number; ending: number }> = [];
  const block = text.match(/consolidated balance summary([\s\S]*?)(?:\*end\*consolidated|total\s+assets)/i);
  const scope = block ? block[1] : text;
  for (const line of scope.split('\n')) {
    const acct = line.match(/\b(\d{12,17})\b/);
    if (!acct) continue;
    const amts = line.match(MONEY_RE);
    if (!amts || amts.length < 2) continue;
    out.push({
      accountNumber: acct[1],
      beginning: parseMoney(amts[amts.length - 2]),
      ending: parseMoney(amts[amts.length - 1]),
    });
  }
  return out;
}

const SECTION_ANCHORS: Array<{ re: RegExp; section: ChaseTxn['section']; sign: 1 | -1 }> = [
  { re: /\*start\*deposits and additions/i, section: 'DEPOSIT', sign: 1 },
  { re: /\*start\*atm\s*debit withdrawal/i, section: 'ATM_DEBIT', sign: -1 },
  { re: /\*start\*electronic\s*withdrawal/i, section: 'ELECTRONIC', sign: -1 },
  { re: /\*start\*(?:fees|service charge)/i, section: 'FEE', sign: -1 },
];

type PendingTxn = { date: string; desc: string; amount: number | null; sign: 1 | -1; section: ChaseTxn['section'] };

/**
 * Passada ÚNICA pelo bloco da conta, carregando o estado da transação através de quebras de página
 * e anchors *end*. A seção ativa é ligada pelos anchors de transação (deposits/atm/electronic/fees)
 * e DESLIGADA (null) por qualquer outro anchor (summary, daily ending balance, consolidated…),
 * para não confundir os valores dos resumos/saldo diário com transações.
 */
function parseAccountTxns(block: string, year: number): ChaseTxn[] {
  const out: ChaseTxn[] = [];
  let section: { name: ChaseTxn['section']; sign: 1 | -1 } | null = null;
  let cur: PendingTxn | null = null;

  const flush = () => {
    if (cur && cur.amount != null) {
      out.push({
        date: cur.date,
        description: cur.desc.trim().replace(/\s{2,}/g, ' '),
        amount: cur.sign * Math.abs(cur.amount),
        section: cur.section,
      });
    }
    cur = null;
  };

  const lastAmount = (line: string): string | null => {
    const amts = line.match(MONEY_RE);
    return amts && amts.length ? amts[amts.length - 1] : null;
  };
  const stripTrailingAmount = (s: string, amtRaw: string): string => {
    const i = s.lastIndexOf(amtRaw);
    return i >= 0 ? s.slice(0, i) : s;
  };

  for (const line of block.split('\n')) {
    const startM = line.match(/\*start\*([a-z0-9 ]+)/i);
    if (startM) {
      const def = SECTION_ANCHORS.find((s) => s.re.test('*start*' + startM[1].toLowerCase()));
      if (def) {
        if (!section || section.name !== def.section) flush(); // nova seção real
        section = { name: def.section, sign: def.sign };
      } else {
        flush();
        section = null; // seção não-transacional
      }
      continue;
    }
    if (/\*end\*/i.test(line)) continue; // mantém a transação viva através do *end*
    if (!section) continue;
    if (/^\s*(DATE|DESCRIPTION|AMOUNT|INSTANCES|Total\b|Page \d+ of \d+)/i.test(line)) continue;
    if (/through\s+[A-Za-z]+\s+\d+,\s+\d{4}/i.test(line)) continue; // cabeçalho de período no topo da página

    const dm = line.match(/^\s*(\d{2})\/(\d{2})\b/);
    if (dm) {
      flush();
      const date = `${year}-${dm[1]}-${dm[2]}`;
      const amtRaw = lastAmount(line);
      let desc = line.replace(/^\s*\d{2}\/\d{2}\s*/, '');
      if (amtRaw) desc = stripTrailingAmount(desc, amtRaw);
      cur = {
        date,
        desc: desc.trim(),
        amount: amtRaw != null ? Math.abs(parseMoney(amtRaw)) : null,
        sign: section.sign,
        section: section.name,
      };
    } else if (cur && line.trim()) {
      if (cur.amount == null) {
        // transação com data numa linha e descrição+valor na(s) seguinte(s) (quebra de página)
        const amtRaw = lastAmount(line);
        if (amtRaw != null) {
          cur.desc = (cur.desc + ' ' + stripTrailingAmount(line, amtRaw)).trim();
          cur.amount = Math.abs(parseMoney(amtRaw));
        } else {
          cur.desc = (cur.desc + ' ' + line.trim()).trim();
        }
      } else {
        cur.desc = (cur.desc + ' ' + line.trim()).trim();
      }
    }
  }
  flush();
  return out;
}

/** Lê "Beginning Balance $X" / "Ending Balance $X" de um bloco de conta (fallback ao consolidado). */
function parseSummaryBalances(block: string): { beginning: number | null; ending: number | null } {
  const b = block.match(/Beginning Balance\s+.*?(-?\$?[\d,]+\.\d{2})/i);
  const e = block.match(/Ending Balance\s+(?:\d+\s+)?.*?(-?\$?[\d,]+\.\d{2})/i);
  return {
    beginning: b ? parseMoney(b[1]) : null,
    ending: e ? parseMoney(e[1]) : null,
  };
}

export function parseChaseStatement(text: string): ChaseStatement {
  const period = parsePeriod(text);
  const year = period.end ? Number(period.end.slice(0, 4)) : new Date().getUTCFullYear();
  const consolidated = parseConsolidated(text);

  // Divide em blocos por conta usando o anchor *start*global product (um por conta).
  const parts = text.split(/\*start\*global\s*product/i);
  const accountBlocks = parts.slice(1); // parts[0] = cabeçalho + consolidated summary

  const accounts: ChaseAccount[] = [];
  for (const block of accountBlocks) {
    const acctM = block.match(/Account Number:\s*(\d{12,17})/i) || block.match(/\b(\d{12,17})\b/);
    if (!acctM) continue;
    const accountNumber = acctM[1];
    const last4 = accountNumber.slice(-4);
    const fromConsolidated = consolidated.find((c) => c.accountNumber === accountNumber);
    const sb = parseSummaryBalances(block);
    const beginningBalance = fromConsolidated?.beginning ?? sb.beginning ?? 0;
    const endingBalance = fromConsolidated?.ending ?? sb.ending ?? 0;

    const transactions = parseAccountTxns(block, year);
    const totalCredits = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const totalDebits = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const computedEnding = Math.round((beginningBalance + totalCredits - totalDebits) * 100) / 100;
    const diff = Math.round((computedEnding - endingBalance) * 100) / 100;

    accounts.push({
      accountNumber,
      last4,
      beginningBalance,
      endingBalance,
      totalCredits: Math.round(totalCredits * 100) / 100,
      totalDebits: Math.round(totalDebits * 100) / 100,
      transactions,
      computedEnding,
      balanced: Math.abs(diff) < 0.01,
      diff,
    });
  }

  return {
    periodStart: period.start,
    periodEnd: period.end,
    periodMonth: period.month,
    accounts,
  };
}
