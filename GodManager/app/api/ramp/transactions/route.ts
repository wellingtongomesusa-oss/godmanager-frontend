import { NextResponse } from 'next/server';

import { getRampApiBase, getRampToken } from '@/lib/ramp-auth';

export const dynamic = 'force-dynamic';

export type RampTransactionsResponse = {
  data: unknown[];
  has_more: boolean;
  total_count: number;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

function normalizeRampTransactionsPayload(raw: unknown): RampTransactionsResponse {
  const o = asRecord(raw);
  if (!o) {
    return { data: [], has_more: false, total_count: 0 };
  }
  const data = o.data;
  if (Array.isArray(data)) {
    return {
      data,
      has_more: typeof o.has_more === 'boolean' ? o.has_more : false,
      total_count: typeof o.total_count === 'number' ? o.total_count : data.length,
    };
  }
  if (Array.isArray(raw)) {
    const arr = raw as unknown[];
    return { data: arr, has_more: false, total_count: arr.length };
  }
  return { data: [], has_more: false, total_count: 0 };
}

/** Ramp `GET /transactions` uses `start` as pagination cursor (last row id), not a datetime. Dates: `from_date`, `to_date` (ISO8601). */
const ISO_DT_RE = /^\d{4}-\d{2}-\d{2}T/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  let fromDate = searchParams.get('from_date');
  let toDate = searchParams.get('to_date');

  const start = searchParams.get('start');
  const end = searchParams.get('end');
  /** Legacy/query convenience: ISO datetimes forwarded as Ramp `from_date` / `to_date`. Raw UUID stays as pagination `start`. */
  let pageCursor: string | null = null;

  if (start) {
    if (ISO_DT_RE.test(start)) {
      fromDate = fromDate ?? start;
    } else if (UUID_RE.test(start)) {
      pageCursor = start;
    }
  }
  if (end && ISO_DT_RE.test(end)) {
    toDate = toDate ?? end;
  }

  const pageSize = searchParams.get('page_size') || '50';

  let token: string;
  try {
    token = await getRampToken();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const base = getRampApiBase();
  const url = new URL(`${base}/transactions`);
  if (fromDate) url.searchParams.set('from_date', fromDate);
  if (toDate) url.searchParams.set('to_date', toDate);
  if (pageCursor) url.searchParams.set('start', pageCursor);
  url.searchParams.set('page_size', pageSize);

  let txRes: Response;
  try {
    txRes = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'Ramp transactions fetch failed', detail: message },
      { status: 502 },
    );
  }

  const bodyText = await txRes.text();
  let parsed: unknown;
  try {
    parsed = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    return NextResponse.json(
      { error: 'Ramp transactions: invalid JSON', detail: bodyText.slice(0, 2000) },
      { status: 502 },
    );
  }

  if (!txRes.ok) {
    return NextResponse.json(
      { error: 'Ramp API rejected transactions request', detail: parsed },
      { status: 502 },
    );
  }

  const normalized = normalizeRampTransactionsPayload(parsed);
  return NextResponse.json(normalized);
}
