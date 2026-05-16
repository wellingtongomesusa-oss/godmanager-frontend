import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { GLEntryType, UserRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TYPE_MAP: Record<string, GLEntryType> = {
  check: GLEntryType.CHECK,
  receipt: GLEntryType.RECEIPT,
  echeck: GLEntryType.ECHECK,
  'echeck receipt': GLEntryType.ECHECK_RECEIPT,
  payment: GLEntryType.PAYMENT,
  je: GLEntryType.JE,
  'cc receipt': GLEntryType.CC_RECEIPT,
  'reverse receipt': GLEntryType.REVERSE_RECEIPT,
  'reversed receipt': GLEntryType.REVERSE_RECEIPT,
  'reversed echeck receipt': GLEntryType.REVERSED_ECHECK_RECEIPT,
  'bank transfer': GLEntryType.BANK_TRANSFER,
  checksend: GLEntryType.CHECK_SEND,
};

function parseAmount(s: string): number | null {
  if (!s || !s.trim()) return null;
  const clean = s.replace(/[",$\s]/g, '');
  const n = parseFloat(clean);
  return Number.isNaN(n) ? null : n;
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(`${m[3]}-${m[1]}-${m[2]}T00:00:00.000Z`);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = '';
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        inQuote = false;
      } else cell += c;
    } else if (c === '"') {
      inQuote = true;
    } else if (c === ',') {
      cur.push(cell);
      cell = '';
    } else if (c === '\n') {
      cur.push(cell);
      rows.push(cur);
      cur = [];
      cell = '';
    } else if (c !== '\r') {
      cell += c;
    }
  }
  if (cell.length || cur.length) {
    cur.push(cell);
    rows.push(cur);
  }
  return rows;
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserFromSession();
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    if (user.role !== UserRole.super_admin) {
      return NextResponse.json({ ok: false, error: 'Forbidden — super_admin only' }, { status: 403 });
    }

    const headerClientId = req.headers.get('x-client-id')?.trim() || null;
    const clientId = user.clientId ?? headerClientId;
    if (!clientId) {
      return NextResponse.json({ ok: false, error: 'No clientId' }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'No file' }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const text = buf.toString('utf-8');
    const contentHash = createHash('sha256').update(buf).digest('hex');

    const exists = await prisma.gLImport.findUnique({ where: { contentHash } });
    if (exists) {
      return NextResponse.json(
        {
          ok: false,
          error: 'duplicate',
          message: 'CSV já foi importado anteriormente',
          previousImportId: exists.id,
          previousUploadedAt: exists.uploadedAt,
        },
        { status: 409 },
      );
    }

    const rows = parseCsv(text);
    const header = rows[0]?.map((s) => s.trim().toLowerCase()) || [];
    const idx = {
      date: header.indexOf('date'),
      payee: header.indexOf('payee / payer'),
      type: header.indexOf('type'),
      reference: header.indexOf('reference'),
      debit: header.indexOf('debit'),
      credit: header.indexOf('credit'),
      balance: header.indexOf('balance'),
      description: header.indexOf('description'),
    };

    let currentAccount: string | null = null;
    let currentCode: string | null = null;
    const entries: Array<{
      clientId: string;
      propertyAddress: string;
      entryDate: Date;
      payee: string | null;
      entryType: GLEntryType;
      reference: string | null;
      debit: number | null;
      credit: number | null;
      balance: number | null;
      description: string | null;
      account: string | null;
      accountCode: string | null;
      txnHash: string;
    }> = [];
    let totalDebit = 0;
    let totalCredit = 0;
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0) continue;
      const first = (r[0] || '').trim();

      if (first.startsWith('->')) {
        const acc = first.replace(/^->\s*/, '').trim();
        currentAccount = acc;
        const codeMatch = acc.match(/^(\d+)/);
        currentCode = codeMatch ? codeMatch[1] : null;
        continue;
      }
      if (!first || first === 'Starting Balance') continue;

      const propertyAddress = first;
      const dateStr = idx.date >= 0 ? r[idx.date] : '';
      const date = parseDate(dateStr);
      if (!date) continue;

      const typeRaw = (idx.type >= 0 ? r[idx.type] : '').trim().toLowerCase();
      const entryType = TYPE_MAP[typeRaw] ?? GLEntryType.OTHER;
      const reference = idx.reference >= 0 ? (r[idx.reference] || '').trim() : '';
      const debit = parseAmount(idx.debit >= 0 ? r[idx.debit] : '');
      const credit = parseAmount(idx.credit >= 0 ? r[idx.credit] : '');
      const balance = parseAmount(idx.balance >= 0 ? r[idx.balance] : '');
      const payee = idx.payee >= 0 ? (r[idx.payee] || '').trim() : '';
      const description = idx.description >= 0 ? (r[idx.description] || '').trim() : '';

      const amount = (debit ?? credit ?? 0).toFixed(2);
      const txnHash = createHash('sha256')
        .update(`${propertyAddress}|${dateStr}|${entryType}|${reference}|${amount}|${currentCode || ''}`)
        .digest('hex');

      if (debit != null) totalDebit += debit;
      if (credit != null) totalCredit += credit;
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;

      entries.push({
        clientId,
        propertyAddress,
        entryDate: date,
        payee: payee || null,
        entryType,
        reference: reference || null,
        debit,
        credit,
        balance,
        description: description || null,
        account: currentAccount,
        accountCode: currentCode,
        txnHash,
      });
    }

    if (entries.length === 0) {
      return NextResponse.json({ ok: false, error: 'no_rows_parsed' }, { status: 400 });
    }

    const authorName =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email;

    const result = await prisma.$transaction(
      async (tx) => {
        const imp = await tx.gLImport.create({
          data: {
            clientId,
            filename: file.name,
            contentHash,
            rowCount: entries.length,
            totalDebit,
            totalCredit,
            periodStart: minDate,
            periodEnd: maxDate,
            uploadedById: user.id,
            uploadedBy: authorName,
          },
        });

        const CHUNK = 500;
        let inserted = 0;
        for (let j = 0; j < entries.length; j += CHUNK) {
          const slice = entries.slice(j, j + CHUNK).map((e) => ({ ...e, glImportId: imp.id }));
          const r = await tx.gLEntry.createMany({ data: slice, skipDuplicates: true });
          inserted += r.count;
        }

        return { imp, inserted };
      },
      { timeout: 50_000 },
    );

    return NextResponse.json({
      ok: true,
      importId: result.imp.id,
      filename: result.imp.filename,
      rowsParsed: entries.length,
      rowsInserted: result.inserted,
      rowsSkippedAsDuplicate: entries.length - result.inserted,
      totalDebit: result.imp.totalDebit,
      totalCredit: result.imp.totalCredit,
      periodStart: result.imp.periodStart,
      periodEnd: result.imp.periodEnd,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown';
    console.error('gl-upload error:', e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
