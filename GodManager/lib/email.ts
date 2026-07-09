import { Resend } from 'resend';
import { prisma } from '@/lib/db';
import { CommentEntityType, Prisma } from '@prisma/client';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

export function isEmailConfigured(): boolean {
  return Boolean(RESEND_API_KEY);
}

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  bcc?: string | string[];
  attachments?: Array<{ filename: string; content: Buffer }>;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (!RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set, skipping send');
    return { ok: false, error: 'not_configured' };
  }

  try {
    const resend = new Resend(RESEND_API_KEY);
    const toList = Array.isArray(opts.to) ? opts.to : [opts.to];
    const bccList = opts.bcc
      ? Array.isArray(opts.bcc)
        ? opts.bcc
        : [opts.bcc]
      : undefined;
    const attachments = opts.attachments?.length
      ? opts.attachments.map((a) => ({
          filename: a.filename,
          content: a.content.toString('base64'),
        }))
      : undefined;

    const { data, error } = await resend.emails.send({
      from: `GodManager <${FROM}>`,
      to: toList,
      ...(bccList && bccList.length ? { bcc: bccList } : {}),
      subject: opts.subject,
      html: opts.html,
      ...(opts.text ? { text: opts.text } : {}),
      replyTo: opts.replyTo,
      ...(attachments ? { attachments } : {}),
    });

    if (error) {
      console.error('[email] resend error:', error);
      const msg =
        typeof error.message === 'string'
          ? error.message
          : JSON.stringify(error);
      return { ok: false, error: msg };
    }

    console.log('[email] sent:', data?.id);
    return { ok: true, id: data?.id };
  } catch (e: unknown) {
    console.error('[email] exception:', e);
    const msg = e instanceof Error ? e.message : 'unknown';
    return { ok: false, error: msg };
  }
}

export type EmailRecipientType = 'TENANT' | 'OWNER' | 'OTHER';

/**
 * Registra no histórico (Comment) que um e-mail foi enviado.
 * REGRA (Wellington): todo e-mail — dono ou inquilino — fica no histórico da CASA
 * (entityType=PROPERTY) automaticamente; se for para um inquilino, também no histórico
 * do INQUILINO (entityType=TENANT). Best-effort: nunca lança.
 */
export async function logEmailToHistory(opts: {
  clientId: string;
  author: { id: string; name: string; role: string };
  to: string | string[];
  subject: string;
  propertyId?: string | null;
  tenantId?: string | null;
  recipientType?: EmailRecipientType;
  kind?: string;
  resendId?: string | null;
}): Promise<boolean> {
  try {
    const toList = Array.isArray(opts.to) ? opts.to : [opts.to];
    const recLabel =
      opts.recipientType === 'TENANT'
        ? 'inquilino'
        : opts.recipientType === 'OWNER'
          ? 'proprietário'
          : 'destinatário';
    const content = `📧 E-mail enviado ao ${recLabel} (${toList.join(', ')}) — Assunto: "${opts.subject}"`;
    const metadata: Prisma.InputJsonValue = {
      type: 'email',
      kind: opts.kind || 'general',
      to: toList,
      subject: opts.subject,
      recipientType: opts.recipientType || 'OTHER',
      resendId: opts.resendId ?? null,
    };

    const targets: Array<{ entityType: CommentEntityType; entityId: string }> = [];
    if (opts.propertyId) targets.push({ entityType: 'PROPERTY', entityId: opts.propertyId });
    if (opts.tenantId) targets.push({ entityType: 'TENANT', entityId: opts.tenantId });
    if (!targets.length) return false;

    await prisma.comment.createMany({
      data: targets.map((t) => ({
        clientId: opts.clientId,
        entityType: t.entityType,
        entityId: t.entityId,
        authorId: opts.author.id,
        authorName: opts.author.name,
        authorRole: opts.author.role,
        content,
        metadata,
        isInternal: true,
      })),
    });
    return true;
  } catch (e) {
    console.error('[logEmailToHistory] falha ao registrar histórico:', e);
    return false;
  }
}

/**
 * Envia um e-mail E registra no histórico (casa + inquilino) num passo só.
 * Use este em vez de sendEmail() sempre que houver contexto de propriedade/inquilino.
 */
export async function sendEmailAndLog(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  bcc?: string | string[];
  clientId: string;
  author: { id: string; name: string; role: string };
  propertyId?: string | null;
  tenantId?: string | null;
  recipientType?: EmailRecipientType;
  kind?: string;
}): Promise<{ ok: boolean; error?: string; id?: string; logged?: boolean }> {
  const sent = await sendEmail({
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    replyTo: opts.replyTo,
    bcc: opts.bcc,
  });
  if (!sent.ok) return sent;

  const logged = await logEmailToHistory({
    clientId: opts.clientId,
    author: opts.author,
    to: opts.to,
    subject: opts.subject,
    propertyId: opts.propertyId,
    tenantId: opts.tenantId,
    recipientType: opts.recipientType,
    kind: opts.kind,
    resendId: sent.id ?? null,
  });

  return { ...sent, logged };
}
