/**
 * SMS Service – Envio de SMS via Twilio
 */

export interface SendSmsParams {
  to: string;
  body: string;
}

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// Número para receber notificações de chat
const NOTIFICATION_PHONE = '+13215194710';

export async function sendSms({ to, body }: SendSmsParams): Promise<SmsResult> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.warn('[SMS] Twilio não configurado. SMS não enviado.');
    return { success: false, error: 'Twilio não configurado' };
  }

  try {
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

    const formData = new URLSearchParams();
    formData.append('To', to);
    formData.append('From', TWILIO_PHONE_NUMBER);
    formData.append('Body', body);

    const res = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!res.ok) {
      const errorData = await res.json();
      console.error('[SMS] Twilio error:', errorData);
      return { success: false, error: errorData.message || 'Erro ao enviar SMS' };
    }

    const data = await res.json();
    return { success: true, messageId: data.sid };
  } catch (err) {
    console.error('[SMS] Exception:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Erro desconhecido' };
  }
}

export async function sendChatNotification(formData: {
  name: string;
  email: string;
  phone?: string;
  service?: string;
  message: string;
}): Promise<SmsResult> {
  const body = `📩 GODROOX CHAT

Nome: ${formData.name}
Email: ${formData.email}
${formData.phone ? `Tel: ${formData.phone}` : ''}
${formData.service ? `Serviço: ${formData.service}` : ''}

Mensagem:
${formData.message.slice(0, 300)}${formData.message.length > 300 ? '...' : ''}`;

  return sendSms({ to: NOTIFICATION_PHONE, body });
}
