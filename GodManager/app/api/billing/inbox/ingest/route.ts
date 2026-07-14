import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/billing/inbox/ingest?secret=XXX
 *
 * Webhook de INGESTÃO de invoices por e-mail. Um provedor de inbound email
 * (SendGrid Inbound Parse, Mailgun Routes, AWS SES+SNS…) encaminha o e-mail
 * recebido em w@godmanager.us para cá; criamos um BillingDocument (INVOICE)
 * que aparece na "Caixa de Entrada" de quem tem o e-mail destinatário.
 *
 * SEGURANÇA (endpoint público que escreve no banco):
 *  - fail-closed: exige BILLING_INBOX_SECRET (via ?secret= ou header x-inbox-secret).
 *  - só aceita destinatários (to) que correspondam a um User existente — nada de
 *    registros órfãos a partir de e-mails desconhecidos.
 *  - idempotente por Message-ID (retry do provedor não duplica).
 *  - nunca confia em instruções do corpo do e-mail; só extrai dados.
 */

type ParsedEmail = {
  from: string;
  fromName: string | null;
  to: string;
  subject: string;
  text: string;
  messageId: string | null;
  attachments: Array<{ filename: string; contentType: string | null; size: number | null }>;
};

function firstEmail(s: string | null | undefined): string {
  if (!s) return '';
  const m = String(s).match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return m ? m[0].toLowerCase() : '';
}

function displayName(s: string | null | undefined): string | null {
  if (!s) return null;
  const str = String(s).trim();
  // "Nome <email@x.com>" → Nome ; senão null (fica só o e-mail)
  const m = str.match(/^"?([^"<]+?)"?\s*</);
  if (m && m[1].trim()) return m[1].trim();
  return null;
}

/** Extrai o maior valor monetário plausível do assunto/corpo (fallback 0). */
function parseAmount(text: string): number {
  const matches = String(text).match(/\$\s?([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/g) || [];
  let max = 0;
  for (const raw of matches) {
    const n = Number(raw.replace(/[^0-9.]/g, ''));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

async function parseBody(req: Request): Promise<ParsedEmail> {
  const ct = (req.headers.get('content-type') || '').toLowerCase();
  const val = (o: Record<string, unknown>, ...keys: string[]): string => {
    for (const k of keys) {
      for (const kk of Object.keys(o)) {
        if (kk.toLowerCase() === k.toLowerCase() && o[kk] != null && String(o[kk]).trim()) return String(o[kk]);
      }
    }
    return '';
  };

  if (ct.includes('application/json')) {
    const j = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const from = firstEmail(val(j, 'from', 'sender', 'From'));
    const to = firstEmail(val(j, 'to', 'recipient', 'To'));
    const atts = Array.isArray(j.attachments) ? (j.attachments as Array<Record<string, unknown>>) : [];
    return {
      from,
      fromName: displayName(val(j, 'from', 'sender', 'From')),
      to,
      subject: val(j, 'subject', 'Subject'),
      text: val(j, 'text', 'body-plain', 'stripped-text', 'html', 'body-html'),
      messageId: val(j, 'message-id', 'messageId', 'Message-Id') || null,
      attachments: atts.map((a) => ({
        filename: String(a.filename || a.name || 'anexo'),
        contentType: a.contentType ? String(a.contentType) : a.type ? String(a.type) : null,
        size: a.size != null ? Number(a.size) : null,
      })),
    };
  }

  // multipart/form-data ou x-www-form-urlencoded (SendGrid Inbound Parse, Mailgun)
  const form = await req.formData();
  const g = (...keys: string[]): string => {
    for (const k of keys) {
      const v = form.get(k);
      if (v != null && typeof v === 'string' && v.trim()) return v;
    }
    return '';
  };
  const attachments: ParsedEmail['attachments'] = [];
  for (const [key, value] of form.entries()) {
    if (typeof value !== 'string' && value && typeof (value as File).name === 'string') {
      const f = value as File;
      attachments.push({ filename: f.name || key, contentType: f.type || null, size: typeof f.size === 'number' ? f.size : null });
    }
  }
  return {
    from: firstEmail(g('from', 'sender', 'From')),
    fromName: displayName(g('from', 'sender', 'From')),
    to: firstEmail(g('to', 'recipient', 'To')),
    subject: g('subject', 'Subject'),
    text: g('text', 'stripped-text', 'body-plain', 'html', 'body-html'),
    messageId: g('message-id', 'Message-Id', 'messageId') || null,
    attachments,
  };
}

export async function POST(req: Request) {
  // 1) Guarda de segredo (fail-closed)
  const expected = process.env.BILLING_INBOX_SECRET;
  if (!expected) {
    return NextResponse.json({ ok: false, error: 'Ingestão desabilitada (defina BILLING_INBOX_SECRET).' }, { status: 503 });
  }
  const url = new URL(req.url);
  const provided = url.searchParams.get('secret') || req.headers.get('x-inbox-secret') || '';
  if (provided !== expected) {
    return NextResponse.json({ ok: false, error: 'Não autorizado.' }, { status: 401 });
  }

  let email: ParsedEmail;
  try {
    email = await parseBody(req);
  } catch {
    return NextResponse.json({ ok: false, error: 'Payload inválido.' }, { status: 400 });
  }

  const to = email.to;
  if (!to) return NextResponse.json({ ok: false, error: 'Destinatário (to) ausente.' }, { status: 400 });

  // 2) Destinatário precisa ser um usuário conhecido (evita órfãos/spam)
  const recipient = await prisma.user.findFirst({
    where: { email: { equals: to, mode: 'insensitive' } },
    select: { id: true, email: true, firstName: true, lastName: true, clientId: true },
  });
  if (!recipient) {
    return NextResponse.json({ ok: false, error: `Destinatário ${to} não corresponde a nenhum usuário.` }, { status: 404 });
  }

  // 3) Idempotência por Message-ID
  if (email.messageId) {
    const dup = await prisma.billingDocument.findFirst({
      where: { docType: 'INVOICE', contactEmail: { equals: to, mode: 'insensitive' }, notes: { contains: email.messageId } },
      select: { id: true },
    });
    if (dup) return NextResponse.json({ ok: true, deduped: true, documentId: dup.id });
  }

  // 4) Monta o documento
  const contactName = `${recipient.firstName ?? ''} ${recipient.lastName ?? ''}`.trim() || to;
  const emitter = email.fromName || email.from || 'Emissor desconhecido';
  const amount = parseAmount(`${email.subject}\n${email.text}`);
  const noteParts = [
    email.subject ? `Assunto: ${email.subject}` : '',
    email.from ? `De: ${email.from}` : '',
    email.attachments.length ? `Anexos: ${email.attachments.map((a) => a.filename).join(', ')}` : '',
    email.messageId ? `msgid:${email.messageId}` : '',
  ].filter(Boolean);

  const prefix = 'INV-';
  try {
    const created = await prisma.$transaction(async (tx) => {
      const latest = await tx.billingDocument.findFirst({
        where: { docType: 'INVOICE', ...(recipient.clientId ? { clientId: recipient.clientId } : { clientId: null }) },
        orderBy: { number: 'desc' },
        select: { number: true },
      });
      let next = 1;
      const mm = latest?.number?.match(/\d+/);
      if (mm) next = parseInt(mm[0], 10) + 1;
      const number = `${prefix}${String(next).padStart(4, '0')}`;

      return tx.billingDocument.create({
        data: {
          clientId: recipient.clientId,
          docType: 'INVOICE',
          number,
          status: 'RECEIVED',
          contactName,
          contactEmail: to,
          receiverName: emitter,
          receiverEmail: email.from || null,
          total: amount,
          notes: noteParts.join(' · ') || null,
          attachments: email.attachments.length ? email.attachments : undefined,
        },
        select: { id: true, number: true },
      });
    });

    await recordAudit({
      request: req,
      actor: { id: 'system', email: 'inbound-email' },
      action: 'billing.inbox.ingest',
      entity: 'billing_document',
      entityId: created.id,
      clientId: recipient.clientId ?? undefined,
      details: `${email.from} → ${to} (${created.number})`,
    });

    return NextResponse.json({ ok: true, documentId: created.id, number: created.number, amount });
  } catch (e) {
    console.error('[billing/inbox/ingest]', e instanceof Error ? e.message : 'error');
    return NextResponse.json({ ok: false, error: 'Falha ao registrar a fatura.' }, { status: 500 });
  }
}
