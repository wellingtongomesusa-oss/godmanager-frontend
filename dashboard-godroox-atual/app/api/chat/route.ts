import { NextResponse } from 'next/server';
import { chatCompletion, getAssistantReply, type ChatMessage } from '@/services/xai.service';

const SYSTEM_PROMPT = `Você é um assistente virtual inteligente do Dashboard Godroox, especializado em:
- Ajudar com dúvidas sobre a plataforma Godroox
- Responder perguntas sobre seguros (Life Insurance)
- Auxiliar com informações sobre LLC na Flórida
- Esclarecer dúvidas sobre pagamentos internacionais
- Fornecer informações sobre Godroox PRO

Seja sempre cordial, objetivo e responda em português do Brasil.
Se não souber algo, seja honesto e sugira contato com o suporte: contact@godroox.com ou WhatsApp +1 (321) 519-4710.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messages } = body as { messages?: ChatMessage[] };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'messages é obrigatório e deve ser um array não vazio.' },
        { status: 400 }
      );
    }

    // Prepend system message
    const fullMessages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages,
    ];

    const response = await chatCompletion(fullMessages, { temperature: 0.7 });
    const reply = getAssistantReply(response);

    return NextResponse.json({
      reply,
      model: response.model,
      usage: response.usage,
    });
  } catch (err) {
    console.error('[API /api/chat] Error:', err);
    const message = err instanceof Error ? err.message : 'Erro interno no chat.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
