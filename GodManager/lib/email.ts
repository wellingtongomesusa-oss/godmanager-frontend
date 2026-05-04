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
  replyTo?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set, skipping send');
    return { ok: false, error: 'not_configured' };
  }

  try {
    const resend = new Resend(RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: `GodManager <${FROM}>`,
      to: Array.isArray(opts.to) ? opts.to : [opts.to],
      subject: opts.subject,
      html: opts.html,
      replyTo: opts.replyTo,
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
    return { ok: true };
  } catch (e: unknown) {
    console.error('[email] exception:', e);
    const msg = e instanceof Error ? e.message : 'unknown';
    return { ok: false, error: msg };
  }
}
