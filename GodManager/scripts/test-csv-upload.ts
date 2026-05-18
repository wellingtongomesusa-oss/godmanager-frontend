/**
 * Smoke test de upload CSV (owner statement). Sem HTTP.
 *
 * Uso:
 *   DATABASE_URL="..." MANAGER_PROP_CLIENT_ID="..." npx tsx scripts/test-csv-upload.ts --file ./exemplo.csv [--dry-run]
 *
 * Imprime JSON com summary + errors.
 */

import fs from 'node:fs';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { parseStatementCsv, statementCsvRowSourceRef } from '@/lib/ownerStatementCsv';
import { recomputeOwnerMonthPayoutTotals } from '@/lib/ownerStatementTotals';

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

function getArg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

function yearMonthFromDateUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function main() {
  const filePath = getArg('--file');
  const dryRun = process.argv.includes('--dry-run');
  const clientIdEnv = process.env.MANAGER_PROP_CLIENT_ID?.trim();

  if (!filePath?.trim()) {
    console.error('Missing --file <path>');
    process.exit(1);
  }
  if (!clientIdEnv) {
    console.error('MANAGER_PROP_CLIENT_ID is required');
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = parseStatementCsv(content);

  if (!parsed.header.ok) {
    console.log(JSON.stringify({ ok: false, missingColumns: parsed.header.missingColumns }, null, 2));
    await prisma.$disconnect();
    return;
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
          where: { code: { in: codes }, clientId: clientIdEnv },
          select: { id: true, code: true, clientId: true },
        })
      : [];

  const byCode = new Map(properties.map((p) => [p.code.toUpperCase(), p]));

  const prepared: PreparedCsvRow[] = [];

  for (const r of okRows) {
    const prop = byCode.get(r.row.propertyCode);
    if (!prop?.clientId || prop.clientId !== clientIdEnv) {
      errors.push({ line: r.line, errors: ['property_not_found_or_out_of_scope'] });
      continue;
    }

    const yearMonth = yearMonthFromDateUtc(r.row.date);
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
      clientId: prop.clientId,
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
      payoutsSummary.set(k, { propertyCode: p.propertyCode, yearMonth: p.yearMonth, additions: 1 });
    } else prev.additions += 1;
  }

  const totalLines = parsed.rows.length;
  const validLines = prepared.length;
  const errorLines = errors.length;

  const baseOut = {
    ok: true as const,
    dryRun,
    summary: {
      totalLines,
      validLines,
      errorLines,
      payouts: [...payoutsSummary.values()],
    },
    errors,
  };

  if (dryRun) {
    console.log(JSON.stringify(baseOut, null, 2));
    await prisma.$disconnect();
    return;
  }

  if (errors.length > 0) {
    console.log(JSON.stringify({ ok: false, errors }, null, 2));
    await prisma.$disconnect();
    process.exitCode = 1;
    return;
  }

  const actor = await prisma.user.findFirst({
    where: { status: 'active', clientId: clientIdEnv },
    select: { id: true, email: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!actor) {
    console.error('No active user found for this client (actorId)');
    await prisma.$disconnect();
    process.exit(1);
  }

  if (prepared.length === 0) {
    console.log(
      JSON.stringify(
        {
          ...baseOut,
          summary: {
            ...baseOut.summary,
            payouts: [],
            created: 0,
            skipped: 0,
          },
          payoutsAffected: [],
        },
        null,
        2
      )
    );
    await prisma.$disconnect();
    return;
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
  const auditClients = new Set(prepared.map((p) => p.clientId));
  const auditClientIdSingle = auditClients.size === 1 ? [...auditClients][0]! : null;

  await prisma.$transaction(async (tx) => {
    for (const row of prepared) {
      const payout = await tx.ownerMonthPayout.upsert({
        where: {
          propertyId_yearMonth: { propertyId: row.propertyId, yearMonth: row.yearMonth },
        },
        create: {
          propertyId: row.propertyId,
          yearMonth: row.yearMonth,
          clientId: row.clientId,
          totalIncome: new Prisma.Decimal(0),
          totalExpenses: new Prisma.Decimal(0),
          netPayout: new Prisma.Decimal(0),
        },
        update: { clientId: row.clientId },
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
        actorId: actor.id,
        actorEmail: actor.email ?? null,
        action: 'owner_statement.csv_upload',
        entity: 'OwnerStatementCsv',
        entityId: null,
        clientId: auditClientIdSingle,
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

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: false,
        summary: {
          totalLines,
          validLines,
          errorLines,
          payouts: [...payoutsSummary.values()],
          created,
          skipped,
        },
        payoutsAffected,
        errors: [],
      },
      null,
      2
    )
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect().finally(() => process.exit(1));
});
