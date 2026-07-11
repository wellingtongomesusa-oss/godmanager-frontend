import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resolveInvestClient } from '@/lib/investServer';

export const dynamic = 'force-dynamic';

function clampPct(v: unknown, def: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1) return def;
  return n;
}

/** POST — salva as premissas globais (entrada, juros, prazo, opex, base de receita). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const scope = await resolveInvestClient(body.clientId != null ? String(body.clientId) : null);
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

  const downPct = clampPct(body.downPct, 0.25);
  const rate = clampPct(body.rate, 0.07);
  const opexPct = clampPct(body.opexPct, 0);
  let termYears = Math.round(Number(body.termYears));
  if (!Number.isFinite(termYears) || termYears < 1 || termYears > 50) termYears = 30;
  const basis = String(body.revenueBasis ?? 'gross');
  const revenueBasis = ['gross', 'owner', 'payouts'].includes(basis) ? basis : 'gross';

  await prisma.investSettings.upsert({
    where: { clientId: scope.clientId },
    create: {
      clientId: scope.clientId,
      downPct: downPct.toFixed(4),
      rate: rate.toFixed(4),
      termYears,
      opexPct: opexPct.toFixed(4),
      revenueBasis,
    },
    update: {
      downPct: downPct.toFixed(4),
      rate: rate.toFixed(4),
      termYears,
      opexPct: opexPct.toFixed(4),
      revenueBasis,
    },
  });
  return NextResponse.json({ ok: true });
}
