import { NextResponse } from 'next/server';
import { computeRentAdvance, TAXA_ANUAL } from '@/lib/rentAdvanceMath';
import { addAdvance, hasOverlappingAdvance } from '@/lib/rentAdvanceStore';

export const dynamic = 'force-dynamic';

const EPS = 1;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.acceptedTerms) {
      return NextResponse.json({ ok: false, error: 'Aceite os termos para continuar.' }, { status: 400 });
    }
    const ownerId = String(body.ownerId || '').trim();
    const months = Number(body.months);
    const netMonthly = Number(body.netMonthly);
    const propertyIds = Array.isArray(body.propertyIds) ? body.propertyIds.map(String) : [];
    if (!ownerId || !Number.isFinite(months) || !Number.isFinite(netMonthly)) {
      return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 });
    }
    if (months < 1 || months > 24 || netMonthly <= 0) {
      return NextResponse.json({ ok: false, error: 'Meses (1–24) ou NET inválido.' }, { status: 400 });
    }
    if (!propertyIds.length) {
      return NextResponse.json({ ok: false, error: 'Nenhuma propriedade elegível.' }, { status: 400 });
    }

    let result;
    try {
      result = computeRentAdvance(months, netMonthly, TAXA_ANUAL);
    } catch {
      return NextResponse.json({ ok: false, error: 'Não foi possível calcular a antecipação.' }, { status: 400 });
    }

    const clientPV = Number(body.presentValue);
    const clientGross = Number(body.grossAmount);
    if (
      Number.isFinite(clientPV) &&
      Number.isFinite(clientGross) &&
      (Math.abs(clientPV - result.presentValue) > EPS || Math.abs(clientGross - result.grossAmount) > EPS)
    ) {
      return NextResponse.json({ ok: false, error: 'Valores não conferem com a simulação. Atualize e tente de novo.' }, { status: 400 });
    }

    if (hasOverlappingAdvance(ownerId, result.periodStart, result.periodEnd)) {
      return NextResponse.json(
        { ok: false, error: 'Já existe antecipação ativa cobrindo parte deste período.' },
        { status: 409 },
      );
    }

    const rec = addAdvance({
      owner_id: ownerId,
      property_ids: propertyIds,
      months,
      gross_amount: result.grossAmount,
      present_value: result.presentValue,
      annual_rate: TAXA_ANUAL,
      period_start: result.periodStart,
      period_end: result.periodEnd,
      status: 'pending',
    });

    return NextResponse.json({
      ok: true,
      advanceId: rec.id,
      status: rec.status,
      amount: rec.present_value,
      createdAt: rec.created_at,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao registrar';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
