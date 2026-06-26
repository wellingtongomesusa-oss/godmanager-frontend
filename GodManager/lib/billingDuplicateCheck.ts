import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

export type BillingDuplicateMatch = {
  id: string;
  number: string;
  propertyId: string | null;
  propertyLabel: string;
  total: number;
  month: string;
  creditParty: string | null;
  debitParty: string | null;
  matchCount: number;
};

export type BillingDuplicateCheckResult =
  | { ok: true }
  | { ok: false; duplicateBlock: BillingDuplicateMatch }
  | { ok: false; duplicateWarning: BillingDuplicateMatch };

function decToNum(v: Prisma.Decimal | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function yearMonthFromDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function normParty(v: string | null | undefined): string | null {
  const s = String(v || '').trim().toUpperCase();
  return s || null;
}

function hasOwnerParty(creditParty: string | null, debitParty: string | null): boolean {
  return normParty(creditParty) === 'OWNER' || normParty(debitParty) === 'OWNER';
}

export function shouldCheckBillingDuplicates(input: {
  docType: string;
  propertyId: string | null;
  creditParty: string | null;
  debitParty: string | null;
}): boolean {
  if (String(input.docType).toUpperCase() !== 'BILL') return false;
  if (!String(input.propertyId || '').trim()) return false;
  return hasOwnerParty(input.creditParty, input.debitParty);
}

function countMatchingFactors(
  target: {
    propertyId: string | null;
    total: number;
    month: string;
    creditParty: string | null;
    debitParty: string | null;
  },
  candidate: {
    propertyId: string | null;
    total: number;
    month: string;
    creditParty: string | null;
    debitParty: string | null;
  }
): number {
  let n = 0;
  const tProp = String(target.propertyId || '').trim();
  const cProp = String(candidate.propertyId || '').trim();
  if (tProp && cProp && tProp === cProp) n++;
  if (roundMoney(target.total) === roundMoney(candidate.total)) n++;
  if (target.month === candidate.month) n++;
  if (normParty(target.creditParty) === normParty(candidate.creditParty)) n++;
  if (normParty(target.debitParty) === normParty(candidate.debitParty)) n++;
  return n;
}

async function propertyLabelMap(ids: string[]): Promise<Map<string, string>> {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (!uniq.length) return new Map();
  const rows = await prisma.property.findMany({
    where: { id: { in: uniq } },
    select: { id: true, code: true, address: true },
  });
  return new Map(
    rows.map((p) => {
      const code = String(p.code || '').trim();
      const addr = String(p.address || '').trim();
      const label = code && addr ? `${code} — ${addr}` : code || addr || p.id;
      return [p.id, label];
    })
  );
}

export async function checkBillingDuplicates(params: {
  clientScopeWhere: Prisma.BillingDocumentWhereInput;
  docType: string;
  propertyId: string | null;
  creditParty: string | null;
  debitParty: string | null;
  total: number;
  issueDate: Date;
  excludeId?: string;
  confirmDuplicate?: boolean;
}): Promise<BillingDuplicateCheckResult> {
  if (!shouldCheckBillingDuplicates(params)) return { ok: true };
  if (params.confirmDuplicate) return { ok: true };

  const target = {
    propertyId: String(params.propertyId || '').trim() || null,
    total: roundMoney(params.total),
    month: yearMonthFromDate(params.issueDate),
    creditParty: normParty(params.creditParty),
    debitParty: normParty(params.debitParty),
  };

  const candidates = await prisma.billingDocument.findMany({
    where: {
      ...params.clientScopeWhere,
      docType: 'BILL',
      status: { not: 'CANCELLED' },
      propertyId: { not: null },
      ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
      OR: [{ creditParty: 'OWNER' }, { debitParty: 'OWNER' }],
    },
    select: {
      id: true,
      number: true,
      propertyId: true,
      total: true,
      issueDate: true,
      creditParty: true,
      debitParty: true,
    },
  });

  let bestBlock: (BillingDuplicateMatch & { matchCount: number }) | null = null;
  let bestWarning: (BillingDuplicateMatch & { matchCount: number }) | null = null;

  for (const c of candidates) {
    const cand = {
      propertyId: String(c.propertyId || '').trim() || null,
      total: decToNum(c.total),
      month: yearMonthFromDate(c.issueDate),
      creditParty: normParty(c.creditParty),
      debitParty: normParty(c.debitParty),
    };
    const matchCount = countMatchingFactors(target, cand);
    if (matchCount < 2) continue;

    const entry = {
      id: c.id,
      number: c.number,
      propertyId: cand.propertyId,
      propertyLabel: cand.propertyId ?? '—',
      total: roundMoney(cand.total),
      month: cand.month,
      creditParty: cand.creditParty,
      debitParty: cand.debitParty,
      matchCount,
    };

    if (matchCount >= 5) {
      if (!bestBlock || matchCount > bestBlock.matchCount) bestBlock = entry;
    } else if (!bestBlock) {
      if (!bestWarning || matchCount > bestWarning.matchCount) bestWarning = entry;
    }
  }

  const labelIds = [
    target.propertyId,
    bestBlock?.propertyId,
    bestWarning?.propertyId,
  ].filter(Boolean) as string[];
  const labels = await propertyLabelMap(labelIds);

  if (bestBlock) {
    const dup: BillingDuplicateMatch = {
      ...bestBlock,
      propertyLabel: labels.get(bestBlock.propertyId ?? '') ?? bestBlock.propertyLabel,
    };
    return { ok: false, duplicateBlock: dup };
  }

  if (bestWarning) {
    const dup: BillingDuplicateMatch = {
      ...bestWarning,
      propertyLabel: labels.get(bestWarning.propertyId ?? '') ?? bestWarning.propertyLabel,
    };
    return { ok: false, duplicateWarning: dup };
  }

  return { ok: true };
}

export function formatBillingDuplicateMoney(total: number): string {
  return `$${roundMoney(total).toFixed(2)}`;
}
