import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { BOOKKEEPING_SPECIALIST_PROMPT } from '@/lib/aiSystemPrompts';

const ALLOWED_EMAIL = 'w@godmanager.us';

type ChatMessage = { role?: string; content?: unknown };

function normalizeMessages(raw: unknown): { role: 'user' | 'assistant'; content: string }[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const m of raw as ChatMessage[]) {
    const role = String(m?.role || 'user') === 'assistant' ? 'assistant' : 'user';
    out.push({ role, content: String(m?.content ?? '') });
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserFromSession();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (String(user.email || '').toLowerCase() !== ALLOWED_EMAIL) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const messages = normalizeMessages(body?.messages);
    if (!messages) {
      return NextResponse.json({ ok: false, error: 'Missing messages' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: 'AI not configured' }, { status: 500 });
    }

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        system: BOOKKEEPING_SPECIALIST_PROMPT,
        messages,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('[ai/bookkeeping] Anthropic API error:', resp.status, errText);
      return NextResponse.json({ ok: false, error: 'AI error: ' + resp.status }, { status: 502 });
    }

    const data = (await resp.json()) as {
      content?: { type?: string; text?: string }[];
      usage?: unknown;
    };
    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text || '')
      .join('\n');
    return NextResponse.json({ ok: true, text, usage: data.usage });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    console.error('[ai/bookkeeping] error:', err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
