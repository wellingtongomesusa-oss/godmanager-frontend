import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';
import { parseStatementCsv, statementCsvRowSourceRef } from '@/lib/ownerStatementCsv';
import { recomputeOwnerMonthPayoutTotals } from '@/lib/ownerStatementTotals';
import { isPayoutClosed } from '@/lib/statementWriteGuard';

export const dynamic = 'force-dynamic';

export const runtime = 'nodejs';

const MAX_BYTES = 5 * 1024 * 1024;

type ParseRowErr = { line: number; errors: string[] };

type PreparedCsvRow = {
  line: number;
  propertyCode: string;
  propertyId: string;
  clientId: string;
  yearMonth: string;
  lineType: 'income' | 'expense';
  description: string;
  amount: number;
  transactionDate: Date;
  sourceRefId: string;
  sortOrder: number;
};

function yearMonthFromDateUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const scopeUser = toClientScopeUser(user);
  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dryRun') === 'true';

  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'file field required' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: 'File too large (max 5MB)' }, { status: 413 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const content = buf.toString('utf8');

    const parsed = parseStatementCsv(content);

    if (!parsed.header.ok) {
      return NextResponse.json(
        { ok: false, missingColumns: parsed.header.missingColumns },
        { status: 400 }
      );
    }

    const errors: ParseRowErr[] = [];
    for (const r of parsed.rows) {
      if (!r.ok) errors.push({ line: r.line, errors: r.errors });
    }

    const okRows = parsed.rows.filter((r): r is Extract<typeof r, { ok: true }> => r.ok);
    const codes = [...new Set(okRows.map((r) => r.row.propertyCode))];

    const properties =
      codes.length > 0
        ? await prisma.property.findMany({
            where: { code: { in: codes }, ...getClientScopeWhere(scopeUser) },
            select: { id: true, code: true, clientId: true },
          })
        : [];

    const byCode = new Map(properties.map((p) => [p.code.toUpperCase(), p]));

    const prepared: PreparedCsvRow[] = [];
    let closedSkipped = 0;

    for (const r of okRows) {
      const prop = byCode.get(r.row.propertyCode);
      if (!prop?.id) {
        errors.push({
          line: r.line,
          errors: ['property_not_found_or_out_of_scope'],
        });
        continue;
      }

      let effectiveClientId = prop.clientId;
      if (!effectiveClientId && scopeUser.clientId) {
        effectiveClientId = scopeUser.clientId;
      }
      if (!effectiveClientId) {
        errors.push({
          line: r.line,
          errors: ['cannot_resolve_clientId'],
        });
        continue;
      }

      const yearMonth = yearMonthFromDateUtc(r.row.date);

      const rowPayout = await prisma.ownerMonthPayout.findUnique({
        where: {
          propertyId_yearMonth: { propertyId: prop.id, yearMonth },
        },
        select: { closedAt: true },
      });
      if (isPayoutClosed(rowPayout)) {
        closedSkipped++;
        continue;
      }

      const dateISO = r.row.date.toISOString().slice(0, 10);
      const amountFixed = r.row.amount.toFixed(2);
      const sourceRefId = statementCsvRowSourceRef({
        propertyCode: r.row.propertyCode,
        dateISO,
        type: r.row.type,
        descriptionTrunc: r.row.description,
        amountFixed,
      });
      const sortOrder = r.row.date.getUTCDate() * 10 + 3;

      prepared.push({
        line: r.line,
        propertyCode: r.row.propertyCode,
        propertyId: prop.id,
        clientId: effectiveClientId,
        yearMonth,
        lineType: r.row.type,
        description: r.row.description,
        amount: r.row.amount,
        transactionDate: r.row.date,
        sourceRefId,
        sortOrder,
      });
    }

    const payoutsSummary = new Map<string, { propertyCode: string; yearMonth: string; additions: number }>();

    for (const p of prepared) {
      const k = `${p.propertyCode}|${p.yearMonth}`;
      const prev = payoutsSummary.get(k);
      if (!prev) {
        payoutsSummary.set(k, {
          propertyCode: p.propertyCode,
          yearMonth: p.yearMonth,
          additions: 1,
        });
      } else {
        prev.additions += 1;
      }
    }

    const totalLines = parsed.rows.length;
    const validLines = prepared.length;
    const errorLines = errors.length;

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        summary: {
          totalLines,
          validLines,
          errorLines,
          closedSkipped,
          payouts: [...payoutsSummary.values()],
        },
        errors,
      });
    }

    if (errors.length > 0) {
      return NextResponse.json({ ok: false, errors }, { status: 400 });
    }

    if (prepared.length === 0) {
      return NextResponse.json({
        ok: true,
        dryRun: false,
        summary: {
          totalLines,
          validLines,
          errorLines,
          closedSkipped,
          payouts: [],
          created: 0,
          skipped: 0,
        },
        payoutsAffected: [],
      });
    }

    let created = 0;
    let skipped = 0;

    const payoutsAffected: {
      payoutId: string;
      propertyId: string;
      propertyCode: string;
      yearMonth: string;
    }[] = [];

    const uniqPayoutSeen = new Set<string>();

    const auditClients = new Set<string>();
    prepared.forEach((p) => auditClients.add(p.clientId));
    const auditClientIdSingle = auditClients.size === 1 ? [...auditClients][0]! : null;

    await prisma.$transaction(async (tx) => {
      for (const row of prepared) {
        const closedGuard = await tx.ownerMonthPayout.findUnique({
          where: {
            propertyId_yearMonth: {
              propertyId: row.propertyId,
              yearMonth: row.yearMonth,
            },
          },
          select: { closedAt: true },
        });
        if (isPayoutClosed(closedGuard)) {
          continue;
        }

        const payout = await tx.ownerMonthPayout.upsert({
          where: {
            propertyId_yearMonth: {
              propertyId: row.propertyId,
              yearMonth: row.yearMonth,
            },
          },
          create: {
            propertyId: row.propertyId,
            yearMonth: row.yearMonth,
            clientId: row.clientId,
            totalIncome: new Prisma.Decimal(0),
            totalExpenses: new Prisma.Decimal(0),
            netPayout: new Prisma.Decimal(0),
          },
          update: {
            clientId: row.clientId,
          },
        });

        if (!uniqPayoutSeen.has(payout.id)) {
          uniqPayoutSeen.add(payout.id);
          payoutsAffected.push({
            payoutId: payout.id,
            propertyId: row.propertyId,
            propertyCode: row.propertyCode,
            yearMonth: row.yearMonth,
          });
        }

        const existing = await tx.statementLineItem.findUnique({
          where: {
            uniq_line_item_source: {
              ownerMonthPayoutId: payout.id,
              source: 'CSV_UPLOAD',
              sourceRefId: row.sourceRefId,
            },
          },
        });

        if (!existing) {
          await tx.statementLineItem.create({
            data: {
              ownerMonthPayoutId: payout.id,
              lineType: row.lineType,
              description: row.description,
              amount: row.amount,
              sortOrder: row.sortOrder,
              clientId: row.clientId,
              source: 'CSV_UPLOAD',
              sourceRefId: row.sourceRefId,
              transactionDate: row.transactionDate,
            },
          });
          created++;
        } else {
          skipped++;
        }
      }

      for (const pid of uniqPayoutSeen) {
        await recomputeOwnerMonthPayoutTotals(pid, tx);
      }

      await tx.auditEntry.create({
        data: {
          actorId: user.id,
          actorEmail: user.email ?? null,
          action: 'owner_statement.csv_upload',
          entity: 'OwnerStatementCsv',
          entityId: null,
          clientId: auditClientIdSingle ?? scopeUser.clientId,
          details: JSON.stringify({
            lines: prepared.length,
            created,
            skipped,
            payoutsAffected: payoutsAffected.map((p) => ({
              payoutId: p.payoutId,
              propertyCode: p.propertyCode,
              yearMonth: p.yearMonth,
            })),
          }),
        },
      });
    });

    return NextResponse.json({
      ok: true,
      dryRun: false,
      summary: {
        totalLines,
        validLines,
        errorLines,
        closedSkipped,
        payouts: [...payoutsSummary.values()],
        created,
        skipped,
      },
      payoutsAffected,
    });
  } catch (e) {
    console.error('[POST /api/manager-pro/owner-statement/csv-upload]', e);
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 });
  }
}
