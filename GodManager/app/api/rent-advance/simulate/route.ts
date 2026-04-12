import { NextResponse } from 'next/server';
import { computeRentAdvance, TAXA_ANUAL } from '@/lib/rentAdvanceMath';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const months = Number(body.months);
    const netMonthly = Number(body.netMonthly);
    const annualRate = body.annualRate != null ? Number(body.annualRate) : TAXA_ANUAL;
    if (!Number.isFinite(months) || !Number.isFinite(netMonthly)) {
      return NextResponse.json({ ok: false, error: 'months e netMonthly são obrigatórios' }, { status: 400 });
    }
    const result = computeRentAdvance(months, netMonthly, annualRate);
    return NextResponse.json({
      ok: true,
      grossAmount: result.grossAmount,
      presentValue: result.presentValue,
      totalDiscount: result.totalDiscount,
      monthlyRate: result.monthlyRate,
      annualRate: result.annualRate,
      effectiveDiscountPct: result.effectiveDiscountPct,
      periodStart: result.periodStart,
      periodEnd: result.periodEnd,
      schedule: result.schedule.map((r) => ({
        month: r.month,
        date: r.dateISO,
        rentGross: r.rentGross,
        discountFactor: r.discountFactor,
        presentValue: r.presentValue,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro na simulação';
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
