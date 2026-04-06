/**
 * xAI (Grok) Service – Integração com a API de chat do xAI.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  model?: string;
  stream?: boolean;
  temperature?: number;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';
const DEFAULT_MODEL = 'grok-3-latest';

export async function chatCompletion(
  messages: ChatMessage[],
  options?: { model?: string; temperature?: number }
): Promise<ChatCompletionResponse> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error('XAI_API_KEY não configurada. Adicione ao .env.local.');
  }

  const body: ChatCompletionRequest = {
    messages,
    model: options?.model ?? DEFAULT_MODEL,
    stream: false,
    temperature: options?.temperature ?? 0.7,
  };

  const res = await fetch(XAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`xAI API error: ${res.status} – ${errorText}`);
  }

  const data = (await res.json()) as ChatCompletionResponse;
  return data;
}

export function getAssistantReply(response: ChatCompletionResponse): string {
  const choice = response.choices?.[0];
  if (!choice) return '';
  return choice.message?.content ?? '';
}
