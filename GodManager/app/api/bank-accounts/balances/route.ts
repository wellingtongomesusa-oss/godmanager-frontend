import { NextResponse } from 'next/server';
import type { BankAccountType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import {
  BANK_ACCOUNT_TYPES,
  canManageBankBalances,
  isValidBankAccountType,
  resolveBankAccountClientScope,
} from '@/lib/bankAccountBalancesScope';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

function parseBalanceDate(raw: unknown): Date | null {
  const s = String(raw ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T12:00:00.000Z');
  return Number.isNaN(d.getTime()) ? null : d;
}

function toSnapshotJson(
  row: {
    id: string;
    accountType: BankAccountType;
    balance: Prisma.Decimal;
    balanceDate: Date;
    recordedAt: Date;
    recordedBy: string | null;
  },
  recordedByName: string | null,
) {
  return {
    id: row.id,
    accountType: row.accountType,
    balance: Number(row.balance),
    balanceDate: row.balanceDate.toISOString().slice(0, 10),
    recordedAt: row.recordedAt.toISOString(),
    recordedBy: row.recordedBy,
    recordedByName,
  };
}

export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  }
  if (!canManageBankBalances(user.role)) {
    return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });
  }

  const url = new URL(req.url);
  const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
  if (!scope.ok) {
    return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
  }

  try {
    const rows = await prisma.bankAccountBalance.findMany({
      where: { clientId: scope.clientId },
      orderBy: [{ balanceDate: 'desc' }, { recordedAt: 'desc' }],
    });

    const latestByType = new Map<BankAccountType, (typeof rows)[0]>();
    for (const row of rows) {
      if (!latestByType.has(row.accountType)) {
        latestByType.set(row.accountType, row);
      }
    }

    const userIds = [
      ...new Set(
        [...latestByType.values()]
          .map((r) => r.recordedBy)
          .filter((id): id is string => !!id),
      ),
    ];
    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, firstName: true, lastName: true },
          })
        : [];
    const nameById = new Map(
      users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]),
    );

    const balances: Record<string, ReturnType<typeof toSnapshotJson> | null> = {};
    for (const t of BANK_ACCOUNT_TYPES) {
      const row = latestByType.get(t);
      balances[t] = row
        ? toSnapshotJson(row, row.recordedBy ? nameById.get(row.recordedBy) ?? null : null)
        : null;
    }

    return NextResponse.json({ ok: true, balances });
  } catch (e) {
    console.error('[api/bank-accounts/balances GET]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  }
  if (!canManageBankBalances(user.role)) {
    return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const scope = await resolveBankAccountClientScope(user, body?.clientId);
    if (!scope.ok) {
      return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
    }

    const accountType = String(body?.accountType ?? '').trim();
    if (!isValidBankAccountType(accountType)) {
      return NextResponse.json(
        { ok: false, error: 'accountType inválido. Use TRUST_CHASE, OPERATING_TRUST ou DEPOSIT_SECURITY.' },
        { status: 400 },
      );
    }

    const balanceNum = Number(body?.balance);
    if (!Number.isFinite(balanceNum) || balanceNum < 0) {
      return NextResponse.json(
        { ok: false, error: 'balance deve ser um número finito >= 0.' },
        { status: 400 },
      );
    }

    const balanceDate = parseBalanceDate(body?.balanceDate);
    if (!balanceDate) {
      return NextResponse.json(
        { ok: false, error: 'balanceDate inválida. Use formato YYYY-MM-DD.' },
        { status: 400 },
      );
    }

    const created = await prisma.bankAccountBalance.create({
      data: {
        clientId: scope.clientId,
        accountType,
        balance: new Prisma.Decimal(balanceNum.toFixed(2)),
        balanceDate,
        recordedBy: user.id,
      },
    });

    const balanceDateStr = balanceDate.toISOString().slice(0, 10);
    await recordAudit({
      request: req,
      actor: { id: user.id, email: user.email },
      action: 'bank_balance.create',
      entity: 'bank_account',
      entityId: created.id,
      details: `accountType: ${accountType} | balance: ${balanceNum.toFixed(2)} | balanceDate: ${balanceDateStr}`,
      clientId: scope.clientId,
    });

    const recordedByName = `${user.firstName} ${user.lastName}`.trim();

    return NextResponse.json({
      ok: true,
      snapshot: toSnapshotJson(created, recordedByName),
    });
  } catch (e) {
    console.error('[api/bank-accounts/balances POST]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}
