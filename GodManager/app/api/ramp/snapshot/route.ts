import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';

export const dynamic = 'force-dynamic';

/** GET /api/ramp/snapshot?clientId= → último snapshot de gastos do Ramp. */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  const scope = await resolveBankAccountClientScope(user, new URL(req.url).searchParams.get('clientId'));
  if (!scope.ok) return NextResponse.json({ ok: true, snapshot: null });

  const s = await prisma.rampSpendSnapshot.findUnique({ where: { clientId: scope.clientId } });
  if (!s) return NextResponse.json({ ok: true, snapshot: null });
  return NextResponse.json({
    ok: true,
    snapshot: {
      txCount: s.txCount,
      totalSpend: Number(s.totalSpend).toFixed(2),
      periodFrom: s.periodFrom,
      periodTo: s.periodTo,
      byMonth: s.byMonth ?? [],
      byCategory: s.byCategory ?? [],
      byMerchant: s.byMerchant ?? [],
      byCardholder: s.byCardholder ?? [],
      updatedAt: s.updatedAt.toISOString(),
    },
  });
}

/**
 * POST /api/ramp/snapshot
 *   { clientId?, txCount, totalSpend, periodFrom?, periodTo?, byMonth, byCategory, byMerchant, byCardholder }
 * Salva/atualiza o snapshot (um por cliente) para consulta rápida.
 */
export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const scope = await resolveBankAccountClientScope(user, (body?.clientId as string) ?? null);
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

  const arr = (v: unknown): Prisma.InputJsonValue => (Array.isArray(v) ? (v as Prisma.InputJsonValue) : []);
  const txCount = Number(body?.txCount) || 0;
  const totalSpend = new Prisma.Decimal(Number(body?.totalSpend) || 0);
  const periodFrom = body?.periodFrom ? String(body.periodFrom).slice(0, 10) : null;
  const periodTo = body?.periodTo ? String(body.periodTo).slice(0, 10) : null;

  await prisma.rampSpendSnapshot.upsert({
    where: { clientId: scope.clientId },
    create: {
      clientId: scope.clientId,
      txCount,
      totalSpend,
      periodFrom,
      periodTo,
      byMonth: arr(body?.byMonth),
      byCategory: arr(body?.byCategory),
      byMerchant: arr(body?.byMerchant),
      byCardholder: arr(body?.byCardholder),
    },
    update: {
      txCount,
      totalSpend,
      periodFrom,
      periodTo,
      byMonth: arr(body?.byMonth),
      byCategory: arr(body?.byCategory),
      byMerchant: arr(body?.byMerchant),
      byCardholder: arr(body?.byCardholder),
    },
  });
  return NextResponse.json({ ok: true });
}
