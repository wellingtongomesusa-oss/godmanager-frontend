import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveAnalyticsClientId } from '@/lib/analyticsResolveClientId';
import { UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const chartOfAccounts = [
  { code: '1150', name: 'Operating Cash' },
  { code: '1160', name: 'Security Deposit Cash' },
  { code: '2101', name: 'Mgmt Held Security Deposits' },
  { code: '2103', name: "Last Month's Rent Deposit" },
  { code: '2105', name: 'Mgmt Held Pet Deposits' },
  { code: '2120', name: 'Clearing Account' },
  { code: '2200', name: 'Prepaid Rent' },
  { code: '3150', name: 'Owner Contribution' },
  { code: '3250', name: 'Owner Distribution' },
  { code: '4100', name: 'Rent Income' },
  { code: '4430', name: 'Pet Fee-Non Refundable' },
  { code: '4440', name: 'Application Fee Income' },
  { code: '4460', name: 'Late Fee' },
  { code: '4470', name: 'Utility Reimbursement Fee' },
  { code: '4700', name: 'Miscellaneous Income' },
  { code: '4800', name: 'Convenience Fee' },
  { code: '6050', name: 'Advertising' },
  { code: '6071', name: 'Carpet Cleaning' },
  { code: '6073', name: 'General Maintenance Labor' },
  { code: '6074', name: 'Landscaping' },
  { code: '6075', name: 'HOA Dues' },
  { code: '6076', name: 'Cleaning and Maintenance -Other' },
  { code: '6091', name: 'Property Insurance' },
  { code: '6101', name: 'Legal' },
  { code: '6103', name: 'Other' },
  { code: '6111', name: 'Management Fees' },
  { code: '6112', name: 'Tenant Placement Fees' },
  { code: '6141', name: 'Painting' },
  { code: '6142', name: 'Plumbing' },
  { code: '6143', name: 'Flooring' },
  { code: '6145', name: 'Key/Lock Replacement' },
  { code: '6146', name: 'Roof Repair' },
  { code: '6147', name: 'Repairs - Other' },
  { code: '6171', name: 'Electricity' },
  { code: '6173', name: 'Water' },
  { code: '7010', name: 'Appliances' },
  { code: '7020', name: 'Equipment/Tools' },
  { code: '7030', name: 'Remodel' },
];

const validCodes = new Set(chartOfAccounts.map((a) => a.code));

// POST { limit?: number } → categoriza até N (default 30) entries sem accountCode
export async function POST(req: Request) {
  try {
    const user = await getCurrentUserFromSession();
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    if (user.role !== UserRole.super_admin) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const clientId = await resolveAnalyticsClientId(user, req);
    if (!clientId) return NextResponse.json({ ok: false, error: 'No clientId' }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: 'ANTHROPIC_API_KEY missing' }, { status: 500 });
    }

    let body: { limit?: unknown } = {};
    try {
      body = (await req.json()) as { limit?: unknown };
    } catch {
      body = {};
    }
    const limit = Math.min(50, Math.max(1, parseInt(String(body?.limit ?? 30), 10)));

    const candidates = await prisma.gLEntry.findMany({
      where: {
        clientId,
        OR: [{ accountCode: null }, { accountCode: '' }],
      },
      select: {
        id: true,
        payee: true,
        description: true,
        entryType: true,
        debit: true,
        credit: true,
        propertyAddress: true,
        reference: true,
      },
      take: limit,
      orderBy: { entryDate: 'desc' },
    });

    if (candidates.length === 0) {
      return NextResponse.json({
        ok: true,
        processed: 0,
        categorized: 0,
        skipped: 0,
        message: 'Sem entries para categorizar (todos já têm conta).',
      });
    }

    const accountsList = chartOfAccounts.map((a) => `${a.code} - ${a.name}`).join('\n');

    const items = candidates.map((c, i) => ({
      idx: i,
      id: c.id,
      payee: c.payee || '(no payee)',
      description: c.description || '',
      type: c.entryType,
      amount:
        c.debit != null && Number(c.debit) > 0
          ? `debit ${c.debit}`
          : `credit ${c.credit ?? '0'}`,
      property: c.propertyAddress?.slice(0, 60) || '',
    }));

    const prompt = `You are a CPA categorizing property-management transactions into a standard chart of accounts.

CHART OF ACCOUNTS (choose code from this list ONLY):
${accountsList}

TRANSACTIONS TO CATEGORIZE:
${items.map((i) => `[${i.idx}] payee="${i.payee}" desc="${i.description}" type=${i.type} ${i.amount} property="${i.property}"`).join('\n')}

For each transaction, respond with ONLY a JSON array (no preamble, no markdown):
[
  {"idx": 0, "code": "6142", "reason": "plumbing repair"},
  {"idx": 1, "code": "4100", "reason": "rent payment received"}
]

Rules:
- code MUST be from the chart of accounts above
- reason is a 3-7 word explanation
- if uncertain, use 6103 (Other)
- Receipt/eCheck Receipt/CC Receipt are usually 4100 (Rent Income) unless description says otherwise
- Check/Payment with vendor name suggests expense (6xxx)
- Owner names in payee with Receipt = 3150 Owner Contribution
- Owner names with Check/Payment = 3250 Owner Distribution`;

    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = msg.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({ ok: false, error: 'No text response from Claude' }, { status: 500 });
    }

    let parsed: unknown;
    try {
      const cleaned = textContent.text.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: 'Claude returned invalid JSON',
          raw: textContent.text.slice(0, 500),
        },
        { status: 500 },
      );
    }

    if (!Array.isArray(parsed)) {
      return NextResponse.json({ ok: false, error: 'Expected JSON array' }, { status: 500 });
    }

    const candById = new Map(candidates.map((c) => [c.id, c]));

    const updates: Array<{
      id: string;
      accountCode: string;
      account: string;
      aiReason: string;
    }> = [];

    for (const row of parsed) {
      if (!row || typeof row !== 'object') continue;
      const p = row as { idx?: unknown; code?: unknown; reason?: unknown };
      if (typeof p.idx !== 'number' || !items[p.idx]) continue;
      const codeStr = String(p.code ?? '').trim();
      if (!validCodes.has(codeStr)) continue;
      const item = items[p.idx];
      const account = chartOfAccounts.find((a) => a.code === codeStr);
      updates.push({
        id: item.id,
        accountCode: codeStr,
        account: `${codeStr} - ${account?.name ?? '?'}`,
        aiReason: String(p.reason ?? '').slice(0, 200),
      });
    }

    let applied = 0;
    for (const u of updates) {
      const original = candById.get(u.id)?.description ?? '';
      const descPatch =
        u.aiReason.trim().length > 0
          ? `[AI: ${u.aiReason}] ${original}`.trim().slice(0, 500)
          : undefined;

      await prisma.gLEntry.update({
        where: { id: u.id },
        data: {
          accountCode: u.accountCode,
          account: u.account,
          ...(descPatch !== undefined ? { description: descPatch } : {}),
        },
      });
      applied++;
    }

    return NextResponse.json({
      ok: true,
      processed: candidates.length,
      categorized: applied,
      skipped: candidates.length - applied,
      method: 'claude-sonnet-4-20250514',
      sample: updates.slice(0, 5),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown';
    console.error('categorize-batch error:', e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
