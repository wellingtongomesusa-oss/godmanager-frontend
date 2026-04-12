import { NextResponse } from 'next/server';

import { getRampApiBase, getRampToken } from '@/lib/ramp-auth';

export const dynamic = 'force-dynamic';

export type RampCardPublic = {
  id: string;
  display_name: string | null;
  last_four: string | null;
  cardholder_name: string | null;
  cardholder_email: string | null;
  state: string | null;
  spending_restrictions: unknown;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

function extractCardsArray(raw: unknown): unknown[] {
  const o = asRecord(raw);
  if (!o) return [];
  if (Array.isArray(o.data)) return o.data;
  if (Array.isArray(raw)) return raw as unknown[];
  return [];
}

function mapCard(c: unknown): RampCardPublic {
  const r = asRecord(c) ?? {};
  const user = asRecord(r.user);
  const ch = asRecord(r.cardholder);
  const first = (user?.first_name ?? ch?.first_name) as string | undefined;
  const last = (user?.last_name ?? ch?.last_name) as string | undefined;
  const fromParts = [first, last].filter(Boolean).join(' ').trim();
  const email =
    (r.cardholder_email as string | undefined) ??
    (user?.email as string | undefined) ??
    (ch?.email as string | undefined) ??
    null;
  const name =
    (r.cardholder_name as string | undefined) ??
    (typeof r.display_name === 'string' ? r.display_name : null) ??
    (fromParts || null);
  return {
    id: r.id != null ? String(r.id) : '',
    display_name: typeof r.display_name === 'string' ? r.display_name : null,
    last_four: r.last_four != null ? String(r.last_four) : null,
    cardholder_name: name,
    cardholder_email: email,
    state: r.state != null ? String(r.state) : null,
    spending_restrictions: r.spending_restrictions ?? null,
  };
}

export async function GET() {
  let token: string;
  try {
    token = await getRampToken();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const base = getRampApiBase();
  const url = `${base}/cards?page_size=100`;

  let cardRes: Response;
  try {
    cardRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'Ramp cards fetch failed', detail: message },
      { status: 502 },
    );
  }

  const bodyText = await cardRes.text();
  let parsed: unknown;
  try {
    parsed = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    return NextResponse.json(
      { error: 'Ramp cards: invalid JSON', detail: bodyText.slice(0, 2000) },
      { status: 502 },
    );
  }

  if (!cardRes.ok) {
    return NextResponse.json(
      { error: 'Ramp API rejected cards request', detail: parsed },
      { status: 502 },
    );
  }

  const rows = extractCardsArray(parsed).map(mapCard);
  return NextResponse.json({ data: rows });
}
