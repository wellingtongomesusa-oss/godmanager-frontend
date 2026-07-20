/**
 * Envio de SMS via Twilio (REST API, sem SDK extra). Totalmente env-gated:
 * se TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM nao estiverem definidos,
 * as funcoes sao no-op (retornam not_configured) e nada no site e afetado.
 */

export function twilioConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM
  );
}

export async function sendSms(
  to: string,
  body: string,
): Promise<{ ok: boolean; error?: string; sid?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) return { ok: false, error: 'not_configured' };

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;
    const form = new URLSearchParams({ To: to, From: from, Body: body });
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
    const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
    if (!res.ok) return { ok: false, error: data?.message || `HTTP ${res.status}` };
    return { ok: true, sid: data?.sid };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'error' };
  }
}
