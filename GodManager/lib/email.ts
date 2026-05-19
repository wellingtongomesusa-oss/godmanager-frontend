import { Resend } from 'resend';

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
