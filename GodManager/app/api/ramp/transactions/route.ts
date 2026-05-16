import { NextResponse } from 'next/server';

import { getRampApiBase, getRampToken } from '@/lib/ramp-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

function extractTxRows(parsed: unknown): unknown[] {
  const o = asRecord(parsed);
  if (!o) return [];
  if (Array.isArray(o.data)) return o.data;
  if (Array.isArray(parsed)) return parsed as unknown[];
  return [];
}

function normalizeHasMore(parsed: unknown): boolean {
  const o = asRecord(parsed);
  if (!o) return false;
  if (typeof o.has_more === 'boolean') return o.has_more;
  const pg = asRecord(o.page);
  if (pg && pg.next != null && String(pg.next).length > 0) return true;
  return false;
}

function getNextCursor(parsed: unknown, items: unknown[]): string | null {
  const o = asRecord(parsed);
  if (!o) return null;
  const pg = asRecord(o.page);
  if (pg && typeof pg.next === 'string' && pg.next.trim()) return pg.next.trim();
  if (typeof o.next_start === 'string' && o.next_start.trim()) return o.next_start.trim();
  if (normalizeHasMore(parsed) && items.length > 0) {
    const last = items[items.length - 1];
    const lr = asRecord(last);
    if (lr?.id != null) return String(lr.id);
  }
  return null;
}

/** Ramp `GET /transactions`: `start` = pagination cursor (often transaction UUID). Dates: `from_date`, `to_date` (ISO8601). */
const ISO_DT_RE = /^\d{4}-\d{2}-\d{2}T/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    let fromDate = searchParams.get('from_date');
    let toDate = searchParams.get('to_date');

    const start = searchParams.get('start');
    const end = searchParams.get('end');

    let initialCursor: string | null = null;

    if (start) {
      if (ISO_DT_RE.test(start)) {
        fromDate = fromDate ?? start;
      } else if (UUID_RE.test(start)) {
        initialCursor = start;
      }
    }
    if (end && ISO_DT_RE.test(end)) {
      toDate = toDate ?? end;
    }

    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '100', 10) || 100));
    const maxPages = Math.min(20, Math.max(1, parseInt(searchParams.get('max_pages') || '10', 10) || 10));

    let token: string;
    try {
      token = await getRampToken();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ ok: false, error: message }, { status: 502 });
    }

    const base = getRampApiBase();
    const allTxns: unknown[] = [];
    let cursor: string | null = initialCursor;
    let pageCount = 0;
    let truncated = false;

    while (pageCount < maxPages) {
      const url = new URL(`${base}/transactions`);
      if (fromDate) url.searchParams.set('from_date', fromDate);
      if (toDate) url.searchParams.set('to_date', toDate);
      url.searchParams.set('page_size', String(pageSize));
      if (cursor) url.searchParams.set('start', cursor);

      let txRes: Response;
      try {
        txRes = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return NextResponse.json(
          { ok: false, error: 'Ramp transactions fetch failed', detail: message },
          { status: 502 },
        );
      }

      const bodyText = await txRes.text();
      let parsed: unknown;
      try {
        parsed = bodyText ? JSON.parse(bodyText) : {};
      } catch {
        return NextResponse.json(
          {
            ok: false,
            error: 'Ramp transactions: invalid JSON',
            detail: bodyText.slice(0, 500),
          },
          { status: 502 },
        );
      }

      if (!txRes.ok) {
        return NextResponse.json(
          { ok: false, error: 'Ramp API rejected transactions request', detail: parsed },
          { status: 502 },
        );
      }

      const items = extractTxRows(parsed);
      allTxns.push(...items);

      if (pageCount === 0 && items.length > 0) {
        const sample = asRecord(items[0]) ?? {};
        console.log(
          '[RAMP DEBUG] sample tx:',
          JSON.stringify(
            {
              amount: sample.amount,
              sk_category_name: sample.sk_category_name,
              merchant_name: sample.merchant_name,
              user_transaction_time: sample.user_transaction_time,
            },
            null,
            2,
          ),
        );
      }

      pageCount += 1;

      const next = getNextCursor(parsed, items);

      if (items.length === 0 || !next) {
        break;
      }

      if (pageCount >= maxPages) {
        truncated = true;
        break;
      }

      cursor = next;
    }

    return NextResponse.json({
      ok: true,
      data: allTxns,
      total_count: allTxns.length,
      pages_fetched: pageCount,
      truncated,
      has_more: truncated,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    console.error('[ramp transactions]', e);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
