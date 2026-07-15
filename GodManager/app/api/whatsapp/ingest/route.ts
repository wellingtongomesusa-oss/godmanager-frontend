import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { canAccessClientId, toClientScopeUser } from '@/lib/clientScope';
import { recordAudit } from '@/lib/auditServer';
import { parseWhatsappChat, transcriptForAI } from '@/lib/whatsappParse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type PendingItem = { text: string; from: string; audience: 'TENANT' | 'OWNER' | 'PM' | 'OUTRO'; status: 'PENDENTE' | 'RESPONDIDO'; date?: string };
type Overview = { summary: string; items: PendingItem[]; pendingCount: number };

/**
 * IA: a partir da transcrição, extrai um overview de perguntas/pedidos, quem pediu,
 * se já foi respondido e para quem é a entrega (inquilino/proprietário).
 */
async function buildOverview(transcript: string): Promise<Overview | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const system = `Você analisa uma conversa de WhatsApp entre a administradora de imóveis (PM/gestor) e o inquilino/proprietário. Responda SOMENTE com um JSON válido, sem texto fora do JSON, no formato:
{"summary":"resumo curto em 1-2 frases","items":[{"text":"a pergunta ou pedido, curto","from":"nome de quem pediu","audience":"TENANT|OWNER|PM|OUTRO","status":"PENDENTE|RESPONDIDO","date":"YYYY-MM-DD"}]}
Regras: liste só perguntas/pedidos/solicitações relevantes (ex.: pedir documento, cobrar aluguel, pedir reparo, dúvida). status=RESPONDIDO se houve resposta clara da administradora depois; PENDENTE se ficou sem resposta ou sem entrega. audience = quem a administradora precisa atender. Máximo 15 itens, priorize os pendentes e recentes.`;
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1500,
        system,
        messages: [{ role: 'user', content: `Conversa:\n\n${transcript}` }],
      }),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { content?: { type?: string; text?: string }[] };
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text || '').join('').trim();
    const jsonStr = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const parsed = JSON.parse(jsonStr) as { summary?: string; items?: PendingItem[] };
    const items = Array.isArray(parsed.items) ? parsed.items.slice(0, 20) : [];
    return { summary: String(parsed.summary || ''), items, pendingCount: items.filter((i) => i.status === 'PENDENTE').length };
  } catch (e) {
    console.error('[whatsapp/ingest] overview', e instanceof Error ? e.message : 'error');
    return null;
  }
}

/** POST /api/whatsapp/ingest { propertyId, text, label? } */
export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  if (!user.clientId) return NextResponse.json({ ok: false, error: 'Usuário sem empresa.' }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { propertyId?: string; text?: string; label?: string };
  const propertyId = String(body?.propertyId || '').trim();
  const text = String(body?.text || '');
  if (!propertyId) return NextResponse.json({ ok: false, error: 'propertyId obrigatório.' }, { status: 400 });
  if (text.trim().length < 20) return NextResponse.json({ ok: false, error: 'Conteúdo da conversa muito curto ou vazio.' }, { status: 400 });

  const scopeUser = toClientScopeUser(user);
  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { id: true, clientId: true, address: true, code: true } });
  if (!property) return NextResponse.json({ ok: false, error: 'Propriedade não encontrada.' }, { status: 404 });
  if (!canAccessClientId(scopeUser, property.clientId)) return NextResponse.json({ ok: false, error: 'Sem acesso a esta propriedade.' }, { status: 403 });

  const parsed = parseWhatsappChat(text);
  if (!parsed.count) return NextResponse.json({ ok: false, error: 'Não reconheci mensagens de WhatsApp neste conteúdo.' }, { status: 400 });

  const overview = await buildOverview(transcriptForAI(parsed));

  const label = String(body?.label || '').trim().slice(0, 120) || `Conversa WhatsApp (${parsed.firstDate ?? ''} a ${parsed.lastDate ?? ''})`;
  const pend = overview?.pendingCount ?? 0;
  const content = [
    `📱 ${label}`,
    `${parsed.count} mensagens · ${parsed.participants.join(', ')}`,
    overview?.summary ? `\nResumo: ${overview.summary}` : '',
    pend ? `\n⚠️ ${pend} pendência(s) a resolver.` : '',
  ].filter(Boolean).join('\n');

  const comment = await prisma.comment.create({
    data: {
      clientId: property.clientId ?? user.clientId,
      entityType: 'PROPERTY',
      entityId: property.id,
      authorId: user.id,
      authorName: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || 'Sistema',
      authorRole: String(user.role || ''),
      content,
      isInternal: true,
      metadata: {
        type: 'whatsapp',
        label,
        participants: parsed.participants,
        firstDate: parsed.firstDate,
        lastDate: parsed.lastDate,
        messageCount: parsed.count,
        overview: overview ?? undefined,
        // guarda a transcrição de texto (sem mídia) para consulta
        transcript: parsed.messages.filter((m) => m.kind === 'text').map((m) => ({ d: m.date, s: m.sender, t: m.text })).slice(0, 500),
      },
    },
    select: { id: true },
  });

  await recordAudit({
    request: req,
    actor: { id: user.id, email: user.email },
    action: 'whatsapp.ingest',
    entity: 'property',
    entityId: property.id,
    clientId: property.clientId ?? undefined,
    details: `${parsed.count} msgs · ${pend} pendências`,
  });

  return NextResponse.json({ ok: true, commentId: comment.id, parsed: { count: parsed.count, participants: parsed.participants, firstDate: parsed.firstDate, lastDate: parsed.lastDate }, overview });
}
