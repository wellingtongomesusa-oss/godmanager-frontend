import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { HELP_SYSTEM_PROMPT } from '@/lib/helpManual';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/help  { question }
 * Assistente de ajuda: responde grounded no manual (lib/helpManual). Só usuários logados.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserFromSession();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const question = String(body?.question || '').trim();
    if (!question) {
      return NextResponse.json({ ok: false, error: 'question required' }, { status: 400 });
    }
    if (question.length > 1000) {
      return NextResponse.json({ ok: false, error: 'question too long' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: 'ai_not_configured' }, { status: 503 });
    }

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 700,
        system: HELP_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: question }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('[ai/help] Anthropic error:', resp.status, errText);
      return NextResponse.json({ ok: false, error: 'ai_error' }, { status: 502 });
    }

    const data = (await resp.json()) as { content?: { type?: string; text?: string }[] };
    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text || '')
      .join('\n')
      .trim();

    return NextResponse.json({ ok: true, answer: text });
  } catch (err: unknown) {
    console.error('[ai/help] error:', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
