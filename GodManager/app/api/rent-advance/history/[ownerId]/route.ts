import { NextResponse } from 'next/server';
import { listByOwner } from '@/lib/rentAdvanceStore';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { ownerId: string } }) {
  const raw = params.ownerId || '';
  const ownerId = decodeURIComponent(raw);
  if (!ownerId) {
    return NextResponse.json({ ok: false, error: 'ownerId ausente' }, { status: 400 });
  }
  const rows = listByOwner(ownerId);
  return NextResponse.json({
    ok: true,
    items: rows.map((r) => ({
      id: r.id,
      date: r.created_at.slice(0, 10),
      months: r.months,
      amount: r.present_value,
      period: `${r.period_start} — ${r.period_end}`,
      status: r.status,
    })),
  });
}
