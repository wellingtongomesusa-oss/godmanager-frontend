/**
 * Parser de export de conversa do WhatsApp (_chat.txt).
 * Formato de cada mensagem: "[M/D/YY, H:MM:SS AM/PM] Remetente: texto".
 * Linhas que não batem o padrão são continuação da mensagem anterior (multi-linha).
 * Mídia aparece como "audio omitted", "image omitted", etc. Mensagens de sistema
 * (criou grupo, adicionou, criptografia, apagada) são marcadas como 'system'.
 */

export type WaMessageKind = 'text' | 'media' | 'system';
export type WaMessage = { ts: string; date: string; sender: string; text: string; kind: WaMessageKind };
export type WaParsed = {
  messages: WaMessage[];
  participants: string[];
  firstDate: string | null;
  lastDate: string | null;
  count: number;
};

const LRM = /‎/g; // marca de direção invisível que o WhatsApp injeta
const LINE_RE = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s+(\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M)\]\s+([^:]+?):\s?([\s\S]*)$/;

const MEDIA_HINTS = ['omitted', 'omitido', 'mídia oculta', 'audio omitted', 'image omitted', 'video omitted', 'sticker omitted', 'document omitted', 'GIF omitted'];
const SYSTEM_HINTS = [
  'Messages and calls are end-to-end encrypted',
  'created this group',
  'added you',
  'This message was deleted',
  'as mensagens e as chamadas são',
  'criou o grupo',
  'adicionou',
  'mensagem apagada',
  'changed the group',
  'left',
  'saiu',
];

function normDate(d: string): string {
  // M/D/YY(YY) → YYYY-MM-DD
  const [mm, dd, yy] = d.split('/').map((x) => parseInt(x, 10));
  const year = yy < 100 ? 2000 + yy : yy;
  return `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

function classify(text: string): WaMessageKind {
  const t = text.toLowerCase();
  if (SYSTEM_HINTS.some((h) => text.includes(h) || t.includes(h.toLowerCase()))) return 'system';
  if (MEDIA_HINTS.some((h) => t.includes(h.toLowerCase()))) return 'media';
  return 'text';
}

export function parseWhatsappChat(raw: string): WaParsed {
  const lines = String(raw || '').replace(/\r/g, '').split('\n');
  const messages: WaMessage[] = [];
  for (const rawLine of lines) {
    const line = rawLine.replace(LRM, '');
    if (!line.trim()) continue;
    const m = line.match(LINE_RE);
    if (m) {
      const date = normDate(m[1]);
      const sender = m[3].trim();
      const text = (m[4] || '').trim();
      messages.push({ ts: `${date} ${m[2]}`, date, sender, text, kind: classify(text) });
    } else if (messages.length) {
      // continuação da mensagem anterior
      messages[messages.length - 1].text += '\n' + line;
    }
  }
  const participants = Array.from(
    new Set(messages.filter((x) => x.kind !== 'system').map((x) => x.sender)),
  );
  const dated = messages.map((x) => x.date).filter(Boolean).sort();
  return {
    messages,
    participants,
    firstDate: dated[0] ?? null,
    lastDate: dated[dated.length - 1] ?? null,
    count: messages.length,
  };
}

/** Transcrição enxuta (sem mídia/sistema) para mandar à IA gerar o overview de pendências. */
export function transcriptForAI(parsed: WaParsed, maxChars = 12000): string {
  const lines = parsed.messages
    .filter((m) => m.kind === 'text')
    .map((m) => `[${m.date}] ${m.sender}: ${m.text.replace(/\n+/g, ' ')}`);
  let out = lines.join('\n');
  if (out.length > maxChars) out = out.slice(-maxChars); // mantém as mensagens mais recentes
  return out;
}
