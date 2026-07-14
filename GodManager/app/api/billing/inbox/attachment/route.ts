import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { generateDownloadUrl } from '@/lib/r2';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/billing/inbox/attachment?doc=<id>&i=<idx>
 * Redireciona para uma URL presigned do anexo (original do e-mail) guardado no R2.
 * Só o próprio pagador (contactEmail == e-mail do logado) ou super_admin acessa.
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const docId = (url.searchParams.get('doc') || '').trim();
  const idx = parseInt(url.searchParams.get('i') || '0', 10) || 0;
  if (!docId) return NextResponse.json({ ok: false, error: 'doc ausente.' }, { status: 400 });

  const doc = await prisma.billingDocument.findUnique({
    where: { id: docId },
    select: { contactEmail: true, clientId: true, attachments: true },
  });
  if (!doc) return NextResponse.json({ ok: false, error: 'Fatura não encontrada.' }, { status: 404 });

  const email = (user.email || '').trim().toLowerCase();
  const isOwner = !!doc.contactEmail && doc.contactEmail.trim().toLowerCase() === email;
  const isSuper = user.role === 'super_admin';
  if (!isOwner && !isSuper) {
    return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });
  }

  const list = Array.isArray(doc.attachments) ? (doc.attachments as Array<Record<string, unknown>>) : [];
  const att = list[idx];
  const key = att && typeof att.key === 'string' ? att.key : '';
  if (!key) return NextResponse.json({ ok: false, error: 'Anexo não encontrado.' }, { status: 404 });

  try {
    const filename = att && typeof att.filename === 'string' ? att.filename : undefined;
    const signed = await generateDownloadUrl(key, filename, 300);
    return NextResponse.redirect(signed, 302);
  } catch (e) {
    console.error('[billing/inbox/attachment]', e instanceof Error ? e.message : 'error');
    return NextResponse.json({ ok: false, error: 'Falha ao gerar link do anexo.' }, { status: 500 });
  }
}
