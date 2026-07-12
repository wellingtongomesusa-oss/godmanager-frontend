import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/site-chat  { messages:[{role,content}], locale? }
 * Chat PÚBLICO do site (visitantes não logados) — assistente de vendas/suporte
 * do GodManager e GODREALTOR. Sem autenticação; guarda-corpos de tamanho.
 */

type Msg = { role: 'user' | 'assistant'; content: string };

function normalize(raw: unknown): Msg[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Msg[] = [];
  for (const m of raw.slice(-12)) {
    const role = (m as { role?: string })?.role;
    const content = String((m as { content?: unknown })?.content ?? '').trim();
    if ((role === 'user' || role === 'assistant') && content) {
      out.push({ role, content: content.slice(0, 1500) });
    }
  }
  if (!out.length || out[out.length - 1].role !== 'user') return null;
  return out;
}

const LANG: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  'pt-br': 'Brazilian Portuguese',
  'pt-BR': 'Brazilian Portuguese',
  pt: 'Brazilian Portuguese',
};

function systemPrompt(locale: string): string {
  const lang = LANG[locale] || 'the language of the last user message';
  return `You are SophIA, the friendly assistant on the public website of GodManager (godmanager.us), a property-management platform by Manager Prop LLC, and its sister product GODREALTOR (real-estate exam prep).

Always reply in ${lang}. Be concise, warm, and practical — 1 short paragraph or a few bullets.

What you help with:
- Explain GodManager: property management, owner statements, tenant/rent tracking, maintenance jobs, delinquency/collections, bank reconciliation, QuickBooks integration, reports.
- Explain GODREALTOR: study plans for the real estate exam. Plans: 30 days $19.90, 90 days $49.90 (most popular), 6 months $89.
- Guide visitors to the right next step: "Request a demo", create an account, or the Services page.

Rules:
- Only discuss GodManager, GODREALTOR, property management, and getting started. Politely decline unrelated topics.
- Never invent prices, dates, or features you are unsure about. If unknown, suggest requesting a demo.
- Do not ask for passwords, card numbers, or sensitive data. To sign up or pay, direct them to the site's own buttons.
- If the visitor wants a person, tell them to leave their email via "Request a demo" and the team will follow up.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { messages?: unknown; locale?: string };
    const messages = normalize(body?.messages);
    if (!messages) return NextResponse.json({ ok: false, error: 'Invalid messages' }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ ok: false, error: 'ai_not_configured' }, { status: 503 });

    const locale = String(body?.locale || 'en');
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: systemPrompt(locale),
        messages,
      }),
    });
    if (!resp.ok) {
      console.error('[ai/site-chat] Anthropic error', resp.status, await resp.text().catch(() => ''));
      return NextResponse.json({ ok: false, error: 'ai_error' }, { status: 502 });
    }
    const data = (await resp.json()) as { content?: { type?: string; text?: string }[] };
    const answer = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text || '').join('\n').trim();
    return NextResponse.json({ ok: true, answer });
  } catch (e) {
    console.error('[ai/site-chat]', e);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
