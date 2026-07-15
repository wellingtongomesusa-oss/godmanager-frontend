import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { canAccessClientId, toClientScopeUser } from '@/lib/clientScope';

export const dynamic = 'force-dynamic';

/**
 * GET /api/whatsapp/list?propertyId=
 * Retorna as conversas de WhatsApp já salvas no histórico da casa (Comment metadata.type='whatsapp'):
 * overview (perguntas/pendências) + transcrição, para busca e rastreio.
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  const url = new URL(req.url);
  const propertyId = (url.searchParams.get('propertyId') || '').trim();
  if (!propertyId) return NextResponse.json({ ok: false, error: 'propertyId obrigatório.' }, { status: 400 });

  const scopeUser = toClientScopeUser(user);
  let property = await prisma.property.findUnique({ where: { id: propertyId }, select: { id: true, clientId: true } });
  if (!property) property = await prisma.property.findFirst({ where: { code: propertyId }, select: { id: true, clientId: true } });
  if (!property) return NextResponse.json({ ok: false, error: 'Propriedade não encontrada.' }, { status: 404 });
  if (!canAccessClientId(scopeUser, property.clientId)) return NextResponse.json({ ok: false, error: 'Sem acesso.' }, { status: 403 });

  const rows = await prisma.comment.findMany({
    where: { entityType: 'PROPERTY', entityId: property.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true, metadata: true },
  });

  const conversations = rows
    .map((r) => {
      const m = (r.metadata && typeof r.metadata === 'object' ? (r.metadata as Record<string, unknown>) : {}) as Record<string, unknown>;
      if (m.type !== 'whatsapp') return null;
      return {
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        label: (m.label as string) ?? null,
        participants: Array.isArray(m.participants) ? (m.participants as string[]) : [],
        firstDate: (m.firstDate as string) ?? null,
        lastDate: (m.lastDate as string) ?? null,
        messageCount: (m.messageCount as number) ?? 0,
        overview: m.overview ?? null,
        transcript: Array.isArray(m.transcript) ? (m.transcript as Array<{ d?: string; s?: string; t?: string }>) : [],
      };
    })
    .filter(Boolean);

  return NextResponse.json({ ok: true, conversations });
}
